import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CouponsRepository } from './coupons.repository';
import { RewardsRepository } from '@/modules/rewards/rewards.repository';
import { JambaarsRepository } from '@/modules/jambaar-profile/jambaar-profile.repository';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import { ListCouponsDto } from './dto/list-coupons.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { CouponStatus, Role } from '@/generated/prisma/enums';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private readonly repository: CouponsRepository,
    private readonly rewardsRepository: RewardsRepository,
    private readonly jambaarsRepository: JambaarsRepository,
    private readonly events: EventsService,
    private readonly push: PushService,
  ) {}

  async redeemReward(userId: string, rewardId: string) {
    const reward = await this.rewardsRepository.findRewardById(rewardId);
    if (!reward) throw new NotFoundException('Récompense introuvable');
    if (!reward.isActive) {
      throw new BadRequestException("Cette récompense n'est plus disponible");
    }
    if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
      throw new BadRequestException('Cette récompense a expiré');
    }
    if (!reward.isUnlimited && reward.stockQuantity <= 0) {
      throw new BadRequestException('Rupture de stock pour cette récompense');
    }

    const profile = await this.jambaarsRepository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profil Jambaar introuvable');

    if (profile.totalPoints < reward.pointsCost) {
      throw new BadRequestException(
        `Points insuffisants. Vous avez ${profile.totalPoints} pts, il en faut ${reward.pointsCost}.`,
      );
    }

    // Les deux vérifications ci-dessus (stock, points) sont des
    // pré-contrôles UX pour échouer rapidement avec un message clair.
    // La vraie garantie de cohérence vient de la transaction
    // (CouponsRepository.redeemReward), qui décrémente puis vérifie après
    // coup que ni le stock ni les points ne tombent sous 0 — seule
    // protection fiable contre deux échanges concurrents.
    let coupon: Awaited<ReturnType<CouponsRepository['redeemReward']>>;
    try {
      coupon = await this.repository.redeemReward(
        userId,
        rewardId,
        reward.pointsCost,
        reward.isUnlimited,
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'STOCK_DEPLETED') {
        throw new BadRequestException(
          "Rupture de stock (quelqu'un a pris le dernier entre-temps !)",
        );
      }
      if (err instanceof Error && err.message === 'INSUFFICIENT_POINTS') {
        throw new BadRequestException(
          'Points insuffisants (votre solde a changé entre-temps, réessayez)',
        );
      }
      throw err;
    }

    this.logger.log(
      `COUPON_REDEEMED — ${coupon.id} — userId: ${userId} — rewardId: ${rewardId} — pts: ${reward.pointsCost}`,
    );

    this.events.emitToUser(userId, 'coupon:earned', { coupon });

    this._sendRedeemPush(userId, reward.title).catch((err) =>
      this.logger.error(`Push coupon failed — ${userId}`, err),
    );

    return coupon;
  }

  async getMyCoupons(userId: string, dto: ListCouponsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { data, total } = await this.repository.findMyCoupons(userId, {
      page,
      limit,
      status: dto.status,
    });

    return {
      coupons: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async useCoupon(couponId: string, user: AuthenticatedUser) {
    const coupon = await this.repository.findCouponById(couponId);
    if (!coupon) throw new NotFoundException('Coupon introuvable');

    if (coupon.status === CouponStatus.USED) {
      throw new BadRequestException('Ce coupon a déjà été utilisé');
    }
    if (coupon.status === CouponStatus.EXPIRED) {
      throw new BadRequestException('Ce coupon a expiré');
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      throw new BadRequestException('Ce coupon a expiré');
    }

    if (user.role !== Role.ADMIN) {
      const managedByUserId = coupon.reward.partner?.managedByUserId;
      if (user.id !== managedByUserId) {
        throw new ForbiddenException(
          "Vous n'êtes pas autorisé à valider ce coupon",
        );
      }
    }

    const used = await this.repository.markAsUsed(couponId);

    this.logger.log(`COUPON_USED — ${used.id} — validé par: ${user.id}`);

    this.events.emitToUser(coupon.userId, 'coupon:used', {
      couponId: used.id,
    });

    return used;
  }

  private async _sendRedeemPush(userId: string, rewardTitle: string) {
    const userData =
      await this.jambaarsRepository.findUserForBadgeNotification(userId);
    if (!userData?.expoPushToken) return;

    await this.push.sendToOne({
      token: userData.expoPushToken,
      title: '🎁 Récompense obtenue !',
      body: `Votre coupon pour "${rewardTitle}" est disponible dans votre portefeuille.`,
      data: { type: 'COUPON_EARNED' },
    });
  }
}

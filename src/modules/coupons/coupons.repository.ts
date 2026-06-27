import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { CouponStatus } from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';
import { customAlphabet } from 'nanoid';

const nanoidAlphaNum = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  4,
);

const generateCouponCode = (): string =>
  `JAMBAAR-${nanoidAlphaNum()}-${nanoidAlphaNum()}`;

const COUPON_SELECT = {
  id: true,
  code: true,
  status: true,
  usedAt: true,
  expiresAt: true,
  createdAt: true,
  reward: {
    select: {
      id: true,
      title: true,
      description: true,
      rewardType: true,
      partner: {
        select: { id: true, name: true, logoUrl: true },
      },
    },
  },
} as const;

const COUPON_DETAIL_SELECT = {
  ...COUPON_SELECT,
  userId: true,
  reward: {
    select: {
      ...COUPON_SELECT.reward.select,
      partnerId: true,
      partner: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          managedByUserId: true,
        },
      },
    },
  },
} as const;

export type CouponSummary = Prisma.CouponGetPayload<{
  select: typeof COUPON_SELECT;
}>;

export type CouponDetail = Prisma.CouponGetPayload<{
  select: typeof COUPON_DETAIL_SELECT;
}>;

@Injectable()
export class CouponsRepository extends BaseRepository<PrismaService['coupon']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.coupon);
  }

  findMyCoupons(
    userId: string,
    filters: { page: number; limit: number; status?: CouponStatus },
  ) {
    return this.findManyWithCount<CouponSummary>(
      { userId, ...(filters.status && { status: filters.status }) },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { createdAt: 'desc' },
        select: COUPON_SELECT,
      },
    );
  }

  findCouponById(id: string): Promise<CouponDetail | null> {
    return this.model.findUnique({
      where: { id },
      select: COUPON_DETAIL_SELECT,
    });
  }

  async redeemReward(
    userId: string,
    rewardId: string,
    pointsCost: number,
    isUnlimited: boolean,
  ): Promise<CouponSummary> {
    return this.prisma.$transaction(async (tx) => {
      if (!isUnlimited) {
        const updatedStock = await tx.reward.update({
          where: { id: rewardId },
          data: { stockQuantity: { decrement: 1 } },
          select: { stockQuantity: true },
        });

        if (updatedStock.stockQuantity < 0) {
          throw new Error('STOCK_DEPLETED');
        }
      }

      const updatedProfile = await tx.jambaarsProfile.update({
        where: { userId },
        data: { totalPoints: { decrement: pointsCost } },
        select: { totalPoints: true },
      });

      if (updatedProfile.totalPoints < 0) {
        throw new Error('INSUFFICIENT_POINTS');
      }

      return tx.coupon.create({
        data: {
          userId,
          rewardId,
          code: generateCouponCode(),
          status: CouponStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        select: COUPON_SELECT,
      });
    });
  }

  markAsUsed(id: string): Promise<CouponSummary> {
    return this.model.update({
      where: { id },
      data: { status: CouponStatus.USED, usedAt: new Date() },
      select: COUPON_SELECT,
    });
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { JambaarsRepository } from './jambaar-profile.repository';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import { LeaderboardDto } from './dto/leaderboard.dto';
import { GRADE_THRESHOLDS } from '@/common/utils/points.utils';
import { DonorGrade } from '@/generated/prisma/enums';

@Injectable()
export class JambaarsService {
  private readonly logger = new Logger(JambaarsService.name);

  constructor(
    private readonly repository: JambaarsRepository,
    private readonly events: EventsService,
    private readonly push: PushService,
  ) {}

  async getMyProfile(userId: string) {
    const profile = await this.repository.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profil Jambaar introuvable');

    const progression = this._calculateProgression(
      profile.totalPoints,
      profile.currentGrade,
    );

    const [globalRank, cityRank] = await Promise.all([
      this.repository.getUserRank(userId),
      profile.city
        ? this.repository.getUserRank(userId, { city: profile.city })
        : Promise.resolve(null),
    ]);

    return {
      profile,
      progression,
      ranks: { global: globalRank, city: cityRank },
    };
  }

  async getMyBadges(userId: string) {
    const [earned, all] = await Promise.all([
      this.repository.findUserBadges(userId),
      this.repository.findAllBadges(),
    ]);

    const earnedIds = new Set(earned.map((ub) => ub.badge.id));

    const badges = all.map((badge) => ({
      ...badge,
      isUnlocked: earnedIds.has(badge.id),
      earnedAt: earned.find((ub) => ub.badge.id === badge.id)?.earnedAt ?? null,
    }));

    return { earned: earned.length, total: all.length, badges };
  }

  async getLeaderboard(dto: LeaderboardDto, currentUserId: string) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const [{ data, total }, myRank] = await Promise.all([
      this.repository.findLeaderboard({
        city: dto.city,
        district: dto.district,
        page,
        limit,
      }),
      this.repository.getUserRank(currentUserId, {
        city: dto.city,
        district: dto.district,
      }),
    ]);

    const ranked = data.map((entry, index) => ({
      rank: (page - 1) * limit + index + 1,
      ...entry,
    }));

    const scope = dto.district
      ? `Quartier ${dto.district}`
      : dto.city
        ? `Ville de ${dto.city}`
        : 'Global';

    return {
      scope,
      leaderboard: ranked,
      myRank,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async processBadgesAfterDonation(userId: string) {
    const [profile, userData] = await Promise.all([
      this.repository.findByUserId(userId),
      this.repository.findUserForBadgeNotification(userId),
    ]);

    if (!profile || !userData) return [];

    const [earnedBadges, allBadges] = await Promise.all([
      this.repository.findUserBadges(userId),
      this.repository.findAllBadges(),
    ]);

    const earnedIds = new Set(earnedBadges.map((ub) => ub.badge.id));

    const toAward = allBadges.filter(
      (badge) =>
        !earnedIds.has(badge.id) &&
        this._meetsCriteria(badge.criteria, {
          donationCount: profile.donationCount,
          totalPoints: profile.totalPoints,
          bloodType: profile.user.bloodType ?? '',
        }),
    );

    if (toAward.length === 0) return [];

    await this.repository.awardBadges(
      userId,
      toAward.map((b) => b.id),
    );

    this.events.emitToUser(userId, 'badges:earned', {
      badges: toAward.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        iconUrl: b.iconUrl,
      })),
    });

    if (userData.expoPushToken) {
      const badgeNames = toAward.map((b) => b.name).join(', ');
      this.push
        .sendToOne({
          token: userData.expoPushToken,
          title: '🏆 Nouveau badge débloqué !',
          body: `Vous avez obtenu : ${badgeNames}`,
          data: { type: 'BADGE_EARNED', badges: toAward.map((b) => b.id) },
        })
        .catch((err) =>
          this.logger.error(`Push badge failed — ${userId}`, err),
        );
    }

    this.logger.log(
      `BADGES_AWARDED — ${userId} — ${toAward.map((b) => b.name).join(', ')}`,
    );

    return toAward;
  }

  private _calculateProgression(totalPoints: number, currentGrade: string) {
    const order = Object.keys(GRADE_THRESHOLDS) as DonorGrade[];
    const idx = order.indexOf(currentGrade as DonorGrade);
    const nextGrade = order[idx + 1] ?? null;

    if (!nextGrade) {
      return {
        currentGrade,
        nextGrade: null,
        pointsToNext: 0,
        progressPercent: 100,
      };
    }

    const currentMin =
      GRADE_THRESHOLDS[currentGrade as keyof typeof GRADE_THRESHOLDS];
    const nextMin = GRADE_THRESHOLDS[nextGrade];
    const progressPercent = Math.min(
      Math.round(((totalPoints - currentMin) / (nextMin - currentMin)) * 100),
      100,
    );

    return {
      currentGrade,
      nextGrade,
      pointsToNext: Math.max(nextMin - totalPoints, 0),
      progressPercent,
    };
  }

  private _meetsCriteria(
    criteriaJson: string,
    params: { donationCount: number; totalPoints: number; bloodType: string },
  ): boolean {
    try {
      const c = JSON.parse(criteriaJson) as Record<string, unknown>;
      if (
        c['minDonations'] &&
        params.donationCount < (c['minDonations'] as number)
      )
        return false;
      if (c['minPoints'] && params.totalPoints < (c['minPoints'] as number))
        return false;
      if (c['bloodType'] && params.bloodType !== c['bloodType']) return false;
      if (
        c['exactDonations'] &&
        params.donationCount !== (c['exactDonations'] as number)
      )
        return false;
      return true;
    } catch {
      return false;
    }
  }
}

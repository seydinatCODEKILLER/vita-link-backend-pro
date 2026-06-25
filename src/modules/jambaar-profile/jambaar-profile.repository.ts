import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';

const JAMBAAR_PROFILE_SELECT = {
  id: true,
  totalPoints: true,
  currentGrade: true,
  donationCount: true,
  livesSavedEstimate: true,
  noShowCount: true,
  lastDonationAt: true,
  nextEligibilityAt: true,
  city: true,
  district: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bloodType: true,
    },
  },
} as const;

const LEADERBOARD_SELECT = {
  totalPoints: true,
  currentGrade: true,
  donationCount: true,
  livesSavedEstimate: true,
  city: true,
  district: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bloodType: true,
    },
  },
} as const;

const BADGE_SELECT = {
  earnedAt: true,
  badge: {
    select: {
      id: true,
      name: true,
      description: true,
      iconUrl: true,
      criteria: true,
      isSeasonal: true,
      season: true,
    },
  },
} as const;

// Types dérivés directement des `select` ci-dessus : ils restent toujours
// synchronisés si on ajoute/retire un champ dans un select, sans avoir
// besoin de les redéfinir manuellement.
export type JambaarProfileDetail = Prisma.JambaarsProfileGetPayload<{
  select: typeof JAMBAAR_PROFILE_SELECT;
}>;

export type LeaderboardEntry = Prisma.JambaarsProfileGetPayload<{
  select: typeof LEADERBOARD_SELECT;
}>;

export type UserBadgeEntry = Prisma.UserBadgeGetPayload<{
  select: typeof BADGE_SELECT;
}>;

@Injectable()
export class JambaarsRepository extends BaseRepository<
  PrismaService['jambaarsProfile']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.jambaarsProfile);
  }

  findByUserId(userId: string) {
    return this.model.findUnique({
      where: { userId },
      select: JAMBAAR_PROFILE_SELECT,
    }) as Promise<JambaarProfileDetail | null>;
  }

  findUserForBadgeNotification(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { bloodType: true, expoPushToken: true },
    });
  }

  findUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId },
      select: BADGE_SELECT,
      orderBy: { earnedAt: 'desc' },
    }) as Promise<UserBadgeEntry[]>;
  }

  findAllBadges() {
    return this.prisma.badge.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        iconUrl: true,
        criteria: true,
        isSeasonal: true,
        season: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  awardBadges(userId: string, badgeIds: string[]) {
    return this.prisma.userBadge.createMany({
      data: badgeIds.map((badgeId) => ({ userId, badgeId })),
      skipDuplicates: true,
    });
  }

  findLeaderboard(filters: {
    city?: string;
    district?: string;
    page: number;
    limit: number;
  }) {
    const where = {
      donationCount: { gt: 0 },
      ...(filters.district
        ? {
            district: {
              equals: filters.district,
              mode: 'insensitive' as const,
            },
          }
        : filters.city
          ? { city: { equals: filters.city, mode: 'insensitive' as const } }
          : {}),
    };

    return this.findManyWithCount<LeaderboardEntry>(where, {
      page: filters.page,
      limit: filters.limit,
      orderBy: [{ totalPoints: 'desc' }, { donationCount: 'desc' }],
      select: LEADERBOARD_SELECT,
    });
  }

  async getUserRank(
    userId: string,
    filters: { city?: string; district?: string } = {},
  ): Promise<number | null> {
    const where = {
      donationCount: { gt: 0 },
      ...(filters.district
        ? {
            district: {
              equals: filters.district,
              mode: 'insensitive' as const,
            },
          }
        : filters.city
          ? { city: { equals: filters.city, mode: 'insensitive' as const } }
          : {}),
    };

    const profile = await this.model.findUnique({
      where: { userId },
      select: { totalPoints: true, donationCount: true },
    });

    if (!profile) return null;

    const rank = await this.model.count({
      where: {
        ...where,
        OR: [
          { totalPoints: { gt: profile.totalPoints } },
          {
            totalPoints: profile.totalPoints,
            donationCount: { gt: profile.donationCount },
          },
        ],
      },
    });

    return rank + 1;
  }
}

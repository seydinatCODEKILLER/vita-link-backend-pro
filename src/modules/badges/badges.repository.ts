import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';

const BADGE_ADMIN_SELECT = {
  id: true,
  name: true,
  description: true,
  iconUrl: true,
  criteria: true,
  isSeasonal: true,
  season: true,
  isActive: true,
  createdAt: true,
} as const;

const BADGE_STATUS_SELECT = {
  id: true,
  name: true,
  isActive: true,
} as const;

export type BadgeAdminDetail = Prisma.BadgeGetPayload<{
  select: typeof BADGE_ADMIN_SELECT;
}>;

export type BadgeStatus = Prisma.BadgeGetPayload<{
  select: typeof BADGE_STATUS_SELECT;
}>;

@Injectable()
export class BadgesRepository extends BaseRepository<PrismaService['badge']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.badge);
  }

  findAllForAdmin(): Promise<BadgeAdminDetail[]> {
    return this.model.findMany({
      select: BADGE_ADMIN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findBadgeById(id: string): Promise<BadgeAdminDetail | null> {
    return this.model.findUnique({
      where: { id },
      select: BADGE_ADMIN_SELECT,
    });
  }

  createBadge(data: {
    name: string;
    description: string;
    iconUrl?: string;
    criteria: string;
    isSeasonal?: boolean;
    season?: string;
  }): Promise<BadgeAdminDetail> {
    return this.model.create({
      data,
      select: BADGE_ADMIN_SELECT,
    });
  }

  updateBadge(
    id: string,
    data: {
      name?: string;
      description?: string;
      iconUrl?: string;
      criteria?: string;
      isSeasonal?: boolean;
      season?: string;
    },
  ): Promise<BadgeAdminDetail> {
    return this.model.update({
      where: { id },
      data,
      select: BADGE_ADMIN_SELECT,
    });
  }

  softDelete(id: string): Promise<BadgeStatus> {
    return this.model.update({
      where: { id },
      data: { isActive: false },
      select: BADGE_STATUS_SELECT,
    });
  }

  reactivate(id: string): Promise<BadgeStatus> {
    return this.model.update({
      where: { id },
      data: { isActive: true },
      select: BADGE_STATUS_SELECT,
    });
  }
}

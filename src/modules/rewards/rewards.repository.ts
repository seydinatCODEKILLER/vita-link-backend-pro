import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { RewardType } from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';

const REWARD_PUBLIC_SELECT = {
  id: true,
  title: true,
  description: true,
  pointsCost: true,
  rewardType: true,
  isUnlimited: true,
  expiresAt: true,
  partner: {
    select: { id: true, name: true, logoUrl: true },
  },
} as const;

const REWARD_ADMIN_SELECT = {
  ...REWARD_PUBLIC_SELECT,
  stockQuantity: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const REWARD_STATUS_SELECT = {
  id: true,
  title: true,
  isActive: true,
} as const;

const REWARD_STOCK_SELECT = {
  id: true,
  stockQuantity: true,
} as const;

export type RewardPublic = Prisma.RewardGetPayload<{
  select: typeof REWARD_PUBLIC_SELECT;
}>;

export type RewardAdminDetail = Prisma.RewardGetPayload<{
  select: typeof REWARD_ADMIN_SELECT;
}>;

export type RewardStatus = Prisma.RewardGetPayload<{
  select: typeof REWARD_STATUS_SELECT;
}>;

export type RewardStock = Prisma.RewardGetPayload<{
  select: typeof REWARD_STOCK_SELECT;
}>;

@Injectable()
export class RewardsRepository extends BaseRepository<PrismaService['reward']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.reward);
  }

  findAllAvailable(): Promise<RewardPublic[]> {
    return this.model.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { OR: [{ isUnlimited: true }, { stockQuantity: { gt: 0 } }] },
        ],
      },
      select: REWARD_PUBLIC_SELECT,
      orderBy: { pointsCost: 'asc' },
    });
  }

  findAllForAdmin(): Promise<RewardAdminDetail[]> {
    return this.model.findMany({
      select: REWARD_ADMIN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findRewardById(id: string): Promise<RewardAdminDetail | null> {
    return this.model.findUnique({
      where: { id },
      select: REWARD_ADMIN_SELECT,
    });
  }

  createReward(data: {
    partnerId: string;
    title: string;
    description: string;
    pointsCost: number;
    rewardType: RewardType;
    stockQuantity?: number;
    isUnlimited?: boolean;
    expiresAt?: string | null;
  }): Promise<RewardAdminDetail> {
    return this.model.create({
      data,
      select: REWARD_ADMIN_SELECT,
    });
  }

  updateReward(
    id: string,
    data: {
      partnerId?: string;
      title?: string;
      description?: string;
      pointsCost?: number;
      rewardType?: RewardType;
      stockQuantity?: number;
      isUnlimited?: boolean;
      expiresAt?: string | null;
    },
  ): Promise<RewardAdminDetail> {
    return this.model.update({
      where: { id },
      data,
      select: REWARD_ADMIN_SELECT,
    });
  }

  softDelete(id: string): Promise<RewardStatus> {
    return this.model.update({
      where: { id },
      data: { isActive: false },
      select: REWARD_STATUS_SELECT,
    });
  }

  decrementStock(id: string): Promise<RewardStock> {
    return this.model.update({
      where: { id },
      data: { stockQuantity: { decrement: 1 } },
      select: REWARD_STOCK_SELECT,
    });
  }
}

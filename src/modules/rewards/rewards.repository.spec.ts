import { Test, TestingModule } from '@nestjs/testing';
import { RewardsRepository } from './rewards.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  reward: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

const REWARD_PUBLIC = {
  id: 'reward-1',
  title: 'Ticket de bus gratuit',
  description: 'Valable 1 trajet',
  pointsCost: 150,
  rewardType: 'TRANSPORT_TICKET',
  isUnlimited: false,
  expiresAt: null,
  partner: { id: 'partner-1', name: 'Orange Sonatel', logoUrl: null },
};

const REWARD_ADMIN = {
  ...REWARD_PUBLIC,
  stockQuantity: 50,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const REWARD_STATUS = {
  id: 'reward-1',
  title: 'Ticket de bus gratuit',
  isActive: false,
};

describe('RewardsRepository', () => {
  let repository: RewardsRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(RewardsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllAvailable', () => {
    it('appelle findMany avec les filtres de disponibilité et tri par pointsCost asc', async () => {
      prisma.reward.findMany.mockResolvedValue([REWARD_PUBLIC]);

      const result = await repository.findAllAvailable();

      expect(prisma.reward.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: expect.any(Date) } },
              ],
            },
            { OR: [{ isUnlimited: true }, { stockQuantity: { gt: 0 } }] },
          ],
        },
        select: expect.objectContaining({ id: true, pointsCost: true }),
        orderBy: { pointsCost: 'asc' },
      });
      expect(result).toEqual([REWARD_PUBLIC]);
    });
  });

  describe('findAllForAdmin', () => {
    it('appelle findMany avec le select admin et tri par createdAt desc', async () => {
      prisma.reward.findMany.mockResolvedValue([REWARD_ADMIN]);

      const result = await repository.findAllForAdmin();

      expect(prisma.reward.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          isActive: true,
          createdAt: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([REWARD_ADMIN]);
    });
  });

  describe('findRewardById', () => {
    it('retourne la récompense avec le select admin complet', async () => {
      prisma.reward.findUnique.mockResolvedValue(REWARD_ADMIN);

      const result = await repository.findRewardById('reward-1');

      expect(prisma.reward.findUnique).toHaveBeenCalledWith({
        where: { id: 'reward-1' },
        select: expect.objectContaining({ id: true, isActive: true }),
      });
      expect(result).toEqual(REWARD_ADMIN);
    });

    it('retourne null si la récompense est introuvable', async () => {
      prisma.reward.findUnique.mockResolvedValue(null);

      const result = await repository.findRewardById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('createReward', () => {
    it('crée la récompense avec les données fournies et le select admin', async () => {
      const input = {
        partnerId: 'partner-1',
        title: 'Ticket de bus gratuit',
        description: 'Valable 1 trajet',
        pointsCost: 150,
        rewardType: 'TRANSPORT_TICKET' as any,
        stockQuantity: 50,
        isUnlimited: false,
        expiresAt: null,
      };
      prisma.reward.create.mockResolvedValue(REWARD_ADMIN);

      const result = await repository.createReward(input);

      expect(prisma.reward.create).toHaveBeenCalledWith({
        data: input,
        select: expect.objectContaining({ id: true, isActive: true }),
      });
      expect(result).toEqual(REWARD_ADMIN);
    });
  });

  describe('updateReward', () => {
    it('ne transmet que les champs fournis dans data', async () => {
      const updated = { ...REWARD_ADMIN, pointsCost: 200 };
      prisma.reward.update.mockResolvedValue(updated);

      const result = await repository.updateReward('reward-1', {
        pointsCost: 200,
      });

      expect(prisma.reward.update).toHaveBeenCalledWith({
        where: { id: 'reward-1' },
        data: { pointsCost: 200 },
        select: expect.objectContaining({ id: true }),
      });
      expect(result).toEqual(updated);
    });
  });

  describe('softDelete', () => {
    it('met isActive à false et retourne le select status', async () => {
      prisma.reward.update.mockResolvedValue(REWARD_STATUS);

      const result = await repository.softDelete('reward-1');

      expect(prisma.reward.update).toHaveBeenCalledWith({
        where: { id: 'reward-1' },
        data: { isActive: false },
        select: { id: true, title: true, isActive: true },
      });
      expect(result).toEqual(REWARD_STATUS);
    });
  });

  describe('decrementStock', () => {
    it('décrémente stockQuantity de 1 et retourne le select stock', async () => {
      prisma.reward.update.mockResolvedValue({
        id: 'reward-1',
        stockQuantity: 49,
      });

      const result = await repository.decrementStock('reward-1');

      expect(prisma.reward.update).toHaveBeenCalledWith({
        where: { id: 'reward-1' },
        data: { stockQuantity: { decrement: 1 } },
        select: { id: true, stockQuantity: true },
      });
      expect(result).toEqual({ id: 'reward-1', stockQuantity: 49 });
    });
  });
});

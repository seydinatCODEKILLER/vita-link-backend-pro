import { Test, TestingModule } from '@nestjs/testing';
import { CouponsRepository } from './coupons.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { CouponStatus } from '@/generated/prisma/enums';

const COUPON_SUMMARY = {
  id: 'coupon-1',
  code: 'JAMBAAR-X9K2-M4P7',
  status: CouponStatus.ACTIVE,
  usedAt: null,
  expiresAt: new Date('2026-07-25'),
  createdAt: new Date('2026-06-25'),
  reward: {
    id: 'reward-1',
    title: 'Ticket de bus gratuit',
    description: 'Valable 1 trajet',
    rewardType: 'TRANSPORT_TICKET',
    partner: { id: 'partner-1', name: 'Orange Sonatel', logoUrl: null },
  },
};

const COUPON_DETAIL = {
  ...COUPON_SUMMARY,
  userId: 'user-1',
  reward: {
    ...COUPON_SUMMARY.reward,
    partnerId: 'partner-1',
    partner: {
      id: 'partner-1',
      name: 'Orange Sonatel',
      logoUrl: null,
      managedByUserId: 'admin-1',
    },
  },
};

const createMockPrismaService = () => ({
  coupon: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('CouponsRepository', () => {
  let repository: CouponsRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(CouponsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findCouponById', () => {
    it('retourne le coupon avec le select detail complet', async () => {
      prisma.coupon.findUnique.mockResolvedValue(COUPON_DETAIL);

      const result = await repository.findCouponById('coupon-1');

      expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        select: expect.objectContaining({ id: true, userId: true }),
      });
      expect(result).toEqual(COUPON_DETAIL);
    });

    it('retourne null si le coupon est introuvable', async () => {
      prisma.coupon.findUnique.mockResolvedValue(null);

      const result = await repository.findCouponById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('redeemReward', () => {
    it('exécute la transaction et retourne le coupon créé', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          reward: {
            update: jest.fn().mockResolvedValue({ stockQuantity: 49 }),
          },
          jambaarsProfile: {
            update: jest.fn().mockResolvedValue({ totalPoints: 350 }),
          },
          coupon: { create: jest.fn().mockResolvedValue(COUPON_SUMMARY) },
        };
        return cb(tx);
      });

      const result = await repository.redeemReward(
        'user-1',
        'reward-1',
        150,
        false,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(COUPON_SUMMARY);
    });

    it('lève STOCK_DEPLETED si le stock passe sous 0', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          reward: {
            update: jest.fn().mockResolvedValue({ stockQuantity: -1 }),
          },
          jambaarsProfile: { update: jest.fn() },
          coupon: { create: jest.fn() },
        };
        return cb(tx);
      });

      await expect(
        repository.redeemReward('user-1', 'reward-1', 150, false),
      ).rejects.toThrow('STOCK_DEPLETED');
    });

    it('lève INSUFFICIENT_POINTS si les points passent sous 0', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          reward: {
            update: jest.fn().mockResolvedValue({ stockQuantity: 10 }),
          },
          jambaarsProfile: {
            update: jest.fn().mockResolvedValue({ totalPoints: -1 }),
          },
          coupon: { create: jest.fn() },
        };
        return cb(tx);
      });

      await expect(
        repository.redeemReward('user-1', 'reward-1', 150, false),
      ).rejects.toThrow('INSUFFICIENT_POINTS');
    });

    it('ne décrémente pas le stock si isUnlimited est true', async () => {
      const rewardUpdate = jest.fn();
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          reward: { update: rewardUpdate },
          jambaarsProfile: {
            update: jest.fn().mockResolvedValue({ totalPoints: 350 }),
          },
          coupon: { create: jest.fn().mockResolvedValue(COUPON_SUMMARY) },
        };
        return cb(tx);
      });

      await repository.redeemReward('user-1', 'reward-1', 150, true);

      expect(rewardUpdate).not.toHaveBeenCalled();
    });
  });

  describe('markAsUsed', () => {
    it('met le statut à USED avec usedAt et retourne le select summary', async () => {
      const used = {
        ...COUPON_SUMMARY,
        status: CouponStatus.USED,
        usedAt: new Date(),
      };
      prisma.coupon.update.mockResolvedValue(used);

      const result = await repository.markAsUsed('coupon-1');

      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: {
          status: CouponStatus.USED,
          usedAt: expect.any(Date),
        },
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result).toEqual(used);
    });
  });
});

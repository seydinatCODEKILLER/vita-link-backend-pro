import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repository';
import { RewardsRepository } from '@/modules/rewards/rewards.repository';
import { JambaarsRepository } from '@/modules/jambaar-profile/jambaar-profile.repository';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import { BloodType, CouponStatus, Role } from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';

const createMockCouponsRepository = () => ({
  findMyCoupons: jest.fn(),
  findCouponById: jest.fn(),
  redeemReward: jest.fn(),
  markAsUsed: jest.fn(),
});

const createMockRewardsRepository = () => ({
  findRewardById: jest.fn(),
});

const createMockJambaarsRepository = () => ({
  findByUserId: jest.fn(),
  findUserForBadgeNotification: jest.fn(),
});

const createMockEventsService = () => ({
  emitToUser: jest.fn(),
});

const createMockPushService = () => ({
  sendToOne: jest.fn(),
});

const ACTIVE_REWARD = {
  id: 'reward-1',
  title: 'Ticket de bus gratuit',
  description: 'Valable 1 trajet',
  pointsCost: 150,
  rewardType: 'TRANSPORT_TICKET',
  isUnlimited: false,
  isActive: true,
  expiresAt: null,
  stockQuantity: 10,
  partner: { id: 'partner-1', name: 'Orange Sonatel', logoUrl: null },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const JAMBAAR_PROFILE = {
  userId: 'user-1',
  totalPoints: 500,
};

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
      managedByUserId: 'manager-1',
    },
  },
};

const ADMIN_USER: AuthenticatedUser = {
  id: 'admin-1',
  firstName: 'Fatou',
  lastName: 'Ndiaye',
  email: 'admin@vita-link.sn',
  role: Role.ADMIN,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: null,
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
  employerStructure: null,
};

const MANAGER_USER: AuthenticatedUser = {
  id: 'manager-1',
  firstName: 'Moussa',
  lastName: 'Diallo',
  email: 'manager@vita-link.sn',
  role: Role.HOSPITAL_AGENT,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'structure-1',
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
  employerStructure: null,
};

const OTHER_USER: AuthenticatedUser = {
  id: 'other-1',
  firstName: 'Amadou',
  lastName: 'Ba',
  email: 'donor@vita-link.sn',
  role: Role.DONOR,
  isActive: true,
  bloodType: BloodType.O_POS,
  avatarUrl: null,
  healthStructureId: null,
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
  employerStructure: null,
};

describe('CouponsService', () => {
  let service: CouponsService;
  let repository: ReturnType<typeof createMockCouponsRepository>;
  let rewardsRepository: ReturnType<typeof createMockRewardsRepository>;
  let jambaarsRepository: ReturnType<typeof createMockJambaarsRepository>;
  let events: ReturnType<typeof createMockEventsService>;
  let push: ReturnType<typeof createMockPushService>;

  beforeEach(async () => {
    repository = createMockCouponsRepository();
    rewardsRepository = createMockRewardsRepository();
    jambaarsRepository = createMockJambaarsRepository();
    events = createMockEventsService();
    push = createMockPushService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: CouponsRepository, useValue: repository },
        { provide: RewardsRepository, useValue: rewardsRepository },
        { provide: JambaarsRepository, useValue: jambaarsRepository },
        { provide: EventsService, useValue: events },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get(CouponsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('redeemReward', () => {
    beforeEach(() => {
      rewardsRepository.findRewardById.mockResolvedValue(ACTIVE_REWARD);
      jambaarsRepository.findByUserId.mockResolvedValue(JAMBAAR_PROFILE);
      jambaarsRepository.findUserForBadgeNotification.mockResolvedValue(null);
      repository.redeemReward.mockResolvedValue(COUPON_SUMMARY);
    });

    it('crée un coupon et émet coupon:earned', async () => {
      const result = await service.redeemReward('user-1', 'reward-1');

      expect(repository.redeemReward).toHaveBeenCalledWith(
        'user-1',
        'reward-1',
        ACTIVE_REWARD.pointsCost,
        ACTIVE_REWARD.isUnlimited,
      );
      expect(events.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'coupon:earned',
        {
          coupon: COUPON_SUMMARY,
        },
      );
      expect(result).toEqual(COUPON_SUMMARY);
    });

    it("lève NotFoundException si la récompense n'existe pas", async () => {
      rewardsRepository.findRewardById.mockResolvedValue(null);

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.redeemReward).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si la récompense n'est pas active", async () => {
      rewardsRepository.findRewardById.mockResolvedValue({
        ...ACTIVE_REWARD,
        isActive: false,
      });

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si la récompense a expiré', async () => {
      rewardsRepository.findRewardById.mockResolvedValue({
        ...ACTIVE_REWARD,
        expiresAt: new Date('2025-01-01'),
      });

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le stock est épuisé', async () => {
      rewardsRepository.findRewardById.mockResolvedValue({
        ...ACTIVE_REWARD,
        stockQuantity: 0,
        isUnlimited: false,
      });

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it("lève NotFoundException si le profil Jambaar n'existe pas", async () => {
      jambaarsRepository.findByUserId.mockResolvedValue(null);

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lève BadRequestException si les points sont insuffisants', async () => {
      jambaarsRepository.findByUserId.mockResolvedValue({
        ...JAMBAAR_PROFILE,
        totalPoints: 50,
      });

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException avec message STOCK_DEPLETED depuis la transaction', async () => {
      repository.redeemReward.mockRejectedValue(new Error('STOCK_DEPLETED'));

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException avec message INSUFFICIENT_POINTS depuis la transaction', async () => {
      repository.redeemReward.mockRejectedValue(
        new Error('INSUFFICIENT_POINTS'),
      );

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('propage les erreurs inconnues de la transaction', async () => {
      repository.redeemReward.mockRejectedValue(new Error('DB_ERROR'));

      await expect(service.redeemReward('user-1', 'reward-1')).rejects.toThrow(
        'DB_ERROR',
      );
    });
  });

  describe('getMyCoupons', () => {
    it('retourne les coupons paginés avec les valeurs par défaut', async () => {
      repository.findMyCoupons.mockResolvedValue({
        data: [COUPON_SUMMARY],
        total: 1,
      });

      const result = await service.getMyCoupons('user-1', {});

      expect(repository.findMyCoupons).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(result).toEqual({
        coupons: [COUPON_SUMMARY],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('utilise les valeurs page, limit et status fournis', async () => {
      repository.findMyCoupons.mockResolvedValue({ data: [], total: 0 });

      await service.getMyCoupons('user-1', {
        page: 2,
        limit: 10,
        status: CouponStatus.USED,
      });

      expect(repository.findMyCoupons).toHaveBeenCalledWith('user-1', {
        page: 2,
        limit: 10,
        status: CouponStatus.USED,
      });
    });

    it('calcule correctement totalPages', async () => {
      repository.findMyCoupons.mockResolvedValue({ data: [], total: 45 });

      const result = await service.getMyCoupons('user-1', {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('useCoupon', () => {
    beforeEach(() => {
      repository.findCouponById.mockResolvedValue(COUPON_DETAIL);
      repository.markAsUsed.mockResolvedValue({
        ...COUPON_SUMMARY,
        status: CouponStatus.USED,
        usedAt: new Date(),
      });
    });

    it('valide le coupon pour un admin', async () => {
      const result = await service.useCoupon('coupon-1', ADMIN_USER);

      expect(repository.markAsUsed).toHaveBeenCalledWith('coupon-1');
      expect(events.emitToUser).toHaveBeenCalledWith(
        COUPON_DETAIL.userId,
        'coupon:used',
        { couponId: COUPON_SUMMARY.id },
      );
      expect(result.status).toBe(CouponStatus.USED);
    });

    it('valide le coupon pour le gestionnaire du partenaire', async () => {
      const result = await service.useCoupon('coupon-1', MANAGER_USER);

      expect(repository.markAsUsed).toHaveBeenCalledWith('coupon-1');
      expect(result.status).toBe(CouponStatus.USED);
    });

    it("lève ForbiddenException si l'utilisateur n'est pas le gestionnaire", async () => {
      await expect(service.useCoupon('coupon-1', OTHER_USER)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.markAsUsed).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le coupon est introuvable', async () => {
      repository.findCouponById.mockResolvedValue(null);

      await expect(service.useCoupon('inexistant', ADMIN_USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lève BadRequestException si le coupon est déjà utilisé', async () => {
      repository.findCouponById.mockResolvedValue({
        ...COUPON_DETAIL,
        status: CouponStatus.USED,
      });

      await expect(service.useCoupon('coupon-1', ADMIN_USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le coupon est expiré par statut', async () => {
      repository.findCouponById.mockResolvedValue({
        ...COUPON_DETAIL,
        status: CouponStatus.EXPIRED,
      });

      await expect(service.useCoupon('coupon-1', ADMIN_USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le coupon est expiré par date', async () => {
      repository.findCouponById.mockResolvedValue({
        ...COUPON_DETAIL,
        status: CouponStatus.ACTIVE,
        expiresAt: new Date('2025-01-01'),
      });

      await expect(service.useCoupon('coupon-1', ADMIN_USER)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

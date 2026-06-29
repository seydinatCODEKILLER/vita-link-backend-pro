import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { RewardsRepository } from './rewards.repository';
import { Role } from '@/generated/prisma/enums';

const createMockRepository = () => ({
  findAllAvailable: jest.fn(),
  findAllForAdmin: jest.fn(),
  findRewardById: jest.fn(),
  createReward: jest.fn(),
  updateReward: jest.fn(),
  softDelete: jest.fn(),
  decrementStock: jest.fn(),
});

const ACTIVE_REWARD = {
  id: 'reward-1',
  title: 'Ticket de bus gratuit',
  description: 'Valable 1 trajet',
  pointsCost: 150,
  rewardType: 'TRANSPORT_TICKET',
  isUnlimited: false,
  expiresAt: null,
  stockQuantity: 50,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  partner: { id: 'partner-1', name: 'Orange Sonatel', logoUrl: null },
};

const INACTIVE_REWARD = { ...ACTIVE_REWARD, isActive: false };

const REWARD_STATUS = {
  id: 'reward-1',
  title: 'Ticket de bus gratuit',
  isActive: false,
};

describe('RewardsService', () => {
  let service: RewardsService;
  let repository: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    repository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
        { provide: RewardsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(RewardsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listAvailableRewards', () => {
    it('délègue au repository findAllAvailable', async () => {
      repository.findAllAvailable.mockResolvedValue([ACTIVE_REWARD]);

      const result = await service.listAvailableRewards();

      expect(repository.findAllAvailable).toHaveBeenCalledTimes(1);
      expect(result).toEqual([ACTIVE_REWARD]);
    });
  });

  describe('listAllRewards', () => {
    it('délègue au repository findAllForAdmin', async () => {
      repository.findAllForAdmin.mockResolvedValue([
        ACTIVE_REWARD,
        INACTIVE_REWARD,
      ]);

      const result = await service.listAllRewards();

      expect(repository.findAllForAdmin).toHaveBeenCalledTimes(1);
      expect(result).toEqual([ACTIVE_REWARD, INACTIVE_REWARD]);
    });
  });

  describe('getRewardById', () => {
    it('retourne la récompense active pour un donneur', async () => {
      repository.findRewardById.mockResolvedValue(ACTIVE_REWARD);

      const result = await service.getRewardById('reward-1', Role.DONOR);

      expect(result).toEqual(ACTIVE_REWARD);
    });

    it('retourne une récompense inactive pour un admin', async () => {
      repository.findRewardById.mockResolvedValue(INACTIVE_REWARD);

      const result = await service.getRewardById('reward-1', Role.ADMIN);

      expect(result).toEqual(INACTIVE_REWARD);
    });

    it('lève NotFoundException pour un non-admin si la récompense est inactive', async () => {
      repository.findRewardById.mockResolvedValue(INACTIVE_REWARD);

      await expect(
        service.getRewardById('reward-1', Role.DONOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève NotFoundException si la récompense n'existe pas", async () => {
      repository.findRewardById.mockResolvedValue(null);

      await expect(
        service.getRewardById('inexistant', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createReward', () => {
    it('crée la récompense avec expiresAt null si non fourni', async () => {
      const dto = {
        partnerId: 'partner-1',
        title: 'Ticket de bus gratuit',
        description: 'Valable 1 trajet',
        pointsCost: 150,
        rewardType: 'TRANSPORT_TICKET' as any,
      };
      repository.createReward.mockResolvedValue(ACTIVE_REWARD);

      const result = await service.createReward(dto);

      expect(repository.createReward).toHaveBeenCalledWith({
        ...dto,
        expiresAt: null,
      });
      expect(result).toEqual(ACTIVE_REWARD);
    });

    it('utilise expiresAt fourni dans le dto', async () => {
      const dto = {
        partnerId: 'partner-1',
        title: 'Ticket de bus gratuit',
        description: 'Valable 1 trajet',
        pointsCost: 150,
        rewardType: 'TRANSPORT_TICKET' as any,
        expiresAt: '2026-12-31T23:59:59Z',
      };
      repository.createReward.mockResolvedValue(ACTIVE_REWARD);

      await service.createReward(dto);

      expect(repository.createReward).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: '2026-12-31T23:59:59Z' }),
      );
    });
  });

  describe('updateReward', () => {
    it('met à jour la récompense existante', async () => {
      repository.findRewardById.mockResolvedValue(ACTIVE_REWARD);
      const updated = { ...ACTIVE_REWARD, pointsCost: 200 };
      repository.updateReward.mockResolvedValue(updated);

      const result = await service.updateReward('reward-1', {
        pointsCost: 200,
      });

      expect(repository.findRewardById).toHaveBeenCalledWith('reward-1');
      expect(repository.updateReward).toHaveBeenCalledWith('reward-1', {
        pointsCost: 200,
      });
      expect(result).toEqual(updated);
    });

    it("lève NotFoundException si la récompense n'existe pas", async () => {
      repository.findRewardById.mockResolvedValue(null);

      await expect(
        service.updateReward('inexistant', { pointsCost: 200 }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.updateReward).not.toHaveBeenCalled();
    });
  });

  describe('deactivateReward', () => {
    it('désactive une récompense active', async () => {
      repository.findRewardById.mockResolvedValue(ACTIVE_REWARD);
      repository.softDelete.mockResolvedValue(REWARD_STATUS);

      const result = await service.deactivateReward('reward-1');

      expect(repository.softDelete).toHaveBeenCalledWith('reward-1');
      expect(result).toEqual(REWARD_STATUS);
    });

    it("lève NotFoundException si la récompense n'existe pas", async () => {
      repository.findRewardById.mockResolvedValue(null);

      await expect(service.deactivateReward('inexistant')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si la récompense est déjà désactivée', async () => {
      repository.findRewardById.mockResolvedValue(INACTIVE_REWARD);

      await expect(service.deactivateReward('reward-1')).rejects.toThrow(
        ConflictException,
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});

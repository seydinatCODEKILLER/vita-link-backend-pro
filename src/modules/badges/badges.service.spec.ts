import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { BadgesRepository } from './badges.repository';
import { EventsService } from '@/events/events.service';

const createMockRepository = () => ({
  findAllForAdmin: jest.fn(),
  findBadgeById: jest.fn(),
  createBadge: jest.fn(),
  updateBadge: jest.fn(),
  softDelete: jest.fn(),
  reactivate: jest.fn(),
});

const createMockEventsService = () => ({
  emitToDonors: jest.fn(),
});

const ACTIVE_BADGE = {
  id: 'badge-1',
  name: 'Guerrier',
  description: '5 dons effectués',
  iconUrl: null,
  criteria: '{"minDonations":5}',
  isSeasonal: false,
  season: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

const INACTIVE_BADGE = { ...ACTIVE_BADGE, isActive: false };

describe('BadgesService', () => {
  let service: BadgesService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgesService,
        { provide: BadgesRepository, useValue: repository },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(BadgesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listBadges', () => {
    it('délègue directement au repository', async () => {
      repository.findAllForAdmin.mockResolvedValue([ACTIVE_BADGE]);

      const result = await service.listBadges();

      expect(repository.findAllForAdmin).toHaveBeenCalledTimes(1);
      expect(result).toEqual([ACTIVE_BADGE]);
    });
  });

  describe('createBadge', () => {
    it('crée le badge et émet badges:new aux donneurs', async () => {
      const dto = {
        name: 'Guerrier',
        description: '5 dons effectués',
        criteria: '{"minDonations":5}',
      };
      repository.createBadge.mockResolvedValue(ACTIVE_BADGE);

      const result = await service.createBadge(dto);

      expect(repository.createBadge).toHaveBeenCalledWith(dto);
      expect(events.emitToDonors).toHaveBeenCalledWith('badges:new', {
        badgeId: ACTIVE_BADGE.id,
        name: ACTIVE_BADGE.name,
      });
      expect(result).toEqual(ACTIVE_BADGE);
    });
  });

  describe('updateBadge', () => {
    it('met à jour le badge existant et émet badges:updated', async () => {
      repository.findBadgeById.mockResolvedValue(ACTIVE_BADGE);
      const updated = { ...ACTIVE_BADGE, name: 'Vétéran' };
      repository.updateBadge.mockResolvedValue(updated);

      const result = await service.updateBadge('badge-1', { name: 'Vétéran' });

      expect(repository.findBadgeById).toHaveBeenCalledWith('badge-1');
      expect(repository.updateBadge).toHaveBeenCalledWith('badge-1', {
        name: 'Vétéran',
      });
      expect(events.emitToDonors).toHaveBeenCalledWith('badges:updated', {
        badgeId: updated.id,
        name: updated.name,
      });
      expect(result).toEqual(updated);
    });

    it("lève NotFoundException si le badge n'existe pas", async () => {
      repository.findBadgeById.mockResolvedValue(null);

      await expect(
        service.updateBadge('inexistant', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.updateBadge).not.toHaveBeenCalled();
      expect(events.emitToDonors).not.toHaveBeenCalled();
    });
  });

  describe('deactivateBadge', () => {
    it('désactive un badge actif et émet badges:deactivated', async () => {
      repository.findBadgeById.mockResolvedValue(ACTIVE_BADGE);
      const statusResult = { id: 'badge-1', name: 'Guerrier', isActive: false };
      repository.softDelete.mockResolvedValue(statusResult);

      const result = await service.deactivateBadge('badge-1');

      expect(repository.softDelete).toHaveBeenCalledWith('badge-1');
      expect(events.emitToDonors).toHaveBeenCalledWith('badges:deactivated', {
        badgeId: statusResult.id,
      });
      expect(result).toEqual(statusResult);
    });

    it("lève NotFoundException si le badge n'existe pas", async () => {
      repository.findBadgeById.mockResolvedValue(null);

      await expect(service.deactivateBadge('inexistant')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si le badge est déjà désactivé', async () => {
      repository.findBadgeById.mockResolvedValue(INACTIVE_BADGE);

      await expect(service.deactivateBadge('badge-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
      expect(events.emitToDonors).not.toHaveBeenCalled();
    });
  });

  describe('reactivateBadge', () => {
    it('réactive un badge désactivé et émet badges:new', async () => {
      repository.findBadgeById.mockResolvedValue(INACTIVE_BADGE);
      const statusResult = { id: 'badge-1', name: 'Guerrier', isActive: true };
      repository.reactivate.mockResolvedValue(statusResult);

      const result = await service.reactivateBadge('badge-1');

      expect(repository.reactivate).toHaveBeenCalledWith('badge-1');
      expect(events.emitToDonors).toHaveBeenCalledWith('badges:new', {
        badgeId: statusResult.id,
        name: statusResult.name,
      });
      expect(result).toEqual(statusResult);
    });

    it("lève NotFoundException si le badge n'existe pas", async () => {
      repository.findBadgeById.mockResolvedValue(null);

      await expect(service.reactivateBadge('inexistant')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.reactivate).not.toHaveBeenCalled();
    });

    it('lève ConflictException si le badge est déjà actif', async () => {
      repository.findBadgeById.mockResolvedValue(ACTIVE_BADGE);

      await expect(service.reactivateBadge('badge-1')).rejects.toThrow(
        ConflictException,
      );
      expect(repository.reactivate).not.toHaveBeenCalled();
      expect(events.emitToDonors).not.toHaveBeenCalled();
    });
  });
});

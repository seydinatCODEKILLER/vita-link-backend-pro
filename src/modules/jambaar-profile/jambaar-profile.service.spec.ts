import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { JambaarsService } from './jambaar-profile.service';
import { JambaarsRepository } from './jambaar-profile.repository';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';

const createMockRepository = () => ({
  findByUserId: jest.fn(),
  findUserForBadgeNotification: jest.fn(),
  findUserBadges: jest.fn(),
  findAllBadges: jest.fn(),
  awardBadges: jest.fn(),
  findLeaderboard: jest.fn(),
  getUserRank: jest.fn(),
});

const createMockEventsService = () => ({
  emitToUser: jest.fn(),
});

const createMockPushService = () => ({
  sendToOne: jest.fn().mockResolvedValue(undefined),
});

const PROFILE = {
  id: 'profile-1',
  totalPoints: 620,
  currentGrade: 'SENTINELLE',
  donationCount: 3,
  livesSavedEstimate: 9,
  noShowCount: 0,
  lastDonationAt: null,
  nextEligibilityAt: null,
  city: 'Dakar',
  district: 'Plateau',
  createdAt: new Date('2026-01-01'),
  user: {
    id: 'user-1',
    firstName: 'Awa',
    lastName: 'Diop',
    avatarUrl: null,
    bloodType: 'O_NEG',
  },
};

const BADGE_1 = {
  id: 'badge-1',
  name: 'Premier Pas',
  description: 'Premier don effectué',
  iconUrl: null,
  criteria: '{"minDonations":1}',
  isSeasonal: false,
  season: null,
};

const BADGE_2 = {
  id: 'badge-2',
  name: 'Guerrier',
  description: '5 dons effectués',
  iconUrl: null,
  criteria: '{"minDonations":5}',
  isSeasonal: false,
  season: null,
};

const USER_BADGE_1 = {
  earnedAt: new Date('2026-02-01'),
  badge: BADGE_1,
};

describe('JambaarsService', () => {
  let service: JambaarsService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;
  let push: ReturnType<typeof createMockPushService>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();
    push = createMockPushService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JambaarsService,
        { provide: JambaarsRepository, useValue: repository },
        { provide: EventsService, useValue: events },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get(JambaarsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('retourne le profil avec progression et rangs', async () => {
      repository.findByUserId.mockResolvedValue(PROFILE);
      repository.getUserRank.mockResolvedValueOnce(14).mockResolvedValueOnce(3);

      const result = await service.getMyProfile('user-1');

      expect(result.profile).toEqual(PROFILE);
      expect(result.progression).toBeDefined();
      expect(result.progression.currentGrade).toBe('SENTINELLE');
      expect(result.ranks).toEqual({ global: 14, city: 3 });
    });

    it("retourne cityRank null si le profil n'a pas de ville", async () => {
      repository.findByUserId.mockResolvedValue({ ...PROFILE, city: null });
      repository.getUserRank.mockResolvedValue(14);

      const result = await service.getMyProfile('user-1');

      expect(result.ranks.city).toBeNull();
    });

    it('lève NotFoundException si le profil est introuvable', async () => {
      repository.findByUserId.mockResolvedValue(null);

      await expect(service.getMyProfile('inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyBadges', () => {
    it('retourne les badges avec statut isUnlocked et earnedAt', async () => {
      repository.findUserBadges.mockResolvedValue([USER_BADGE_1]);
      repository.findAllBadges.mockResolvedValue([BADGE_1, BADGE_2]);

      const result = await service.getMyBadges('user-1');

      expect(result.earned).toBe(1);
      expect(result.total).toBe(2);

      const unlocked = result.badges.find((b) => b.id === 'badge-1');
      const locked = result.badges.find((b) => b.id === 'badge-2');

      expect(unlocked?.isUnlocked).toBe(true);
      expect(unlocked?.earnedAt).toEqual(USER_BADGE_1.earnedAt);
      expect(locked?.isUnlocked).toBe(false);
      expect(locked?.earnedAt).toBeNull();
    });

    it('retourne 0 badges gagnés si aucun badge débloqué', async () => {
      repository.findUserBadges.mockResolvedValue([]);
      repository.findAllBadges.mockResolvedValue([BADGE_1, BADGE_2]);

      const result = await service.getMyBadges('user-1');

      expect(result.earned).toBe(0);
      expect(result.badges.every((b) => !b.isUnlocked)).toBe(true);
    });
  });

  describe('getLeaderboard', () => {
    it('retourne le classement global avec rangs calculés', async () => {
      repository.findLeaderboard.mockResolvedValue({
        data: [PROFILE, { ...PROFILE, id: 'profile-2', totalPoints: 400 }],
        total: 2,
      });
      repository.getUserRank.mockResolvedValue(1);

      const result = await service.getLeaderboard({}, 'user-1');

      expect(result.scope).toBe('Global');
      expect(result.leaderboard[0].rank).toBe(1);
      expect(result.leaderboard[1].rank).toBe(2);
      expect(result.myRank).toBe(1);
    });

    it('retourne le scope ville si city est fourni', async () => {
      repository.findLeaderboard.mockResolvedValue({ data: [], total: 0 });
      repository.getUserRank.mockResolvedValue(null);

      const result = await service.getLeaderboard({ city: 'Dakar' }, 'user-1');

      expect(result.scope).toBe('Ville de Dakar');
    });

    it('retourne le scope quartier si district est fourni', async () => {
      repository.findLeaderboard.mockResolvedValue({ data: [], total: 0 });
      repository.getUserRank.mockResolvedValue(null);

      const result = await service.getLeaderboard(
        { city: 'Dakar', district: 'Plateau' },
        'user-1',
      );

      expect(result.scope).toBe('Quartier Plateau');
    });

    it('calcule correctement totalPages', async () => {
      repository.findLeaderboard.mockResolvedValue({ data: [], total: 45 });
      repository.getUserRank.mockResolvedValue(5);

      const result = await service.getLeaderboard(
        { page: 1, limit: 20 },
        'user-1',
      );

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('processBadgesAfterDonation', () => {
    beforeEach(() => {
      repository.findByUserId.mockResolvedValue(PROFILE);
      repository.findUserForBadgeNotification.mockResolvedValue({
        bloodType: 'O_NEG',
        expoPushToken: null,
      });
      repository.findUserBadges.mockResolvedValue([]);
      repository.findAllBadges.mockResolvedValue([BADGE_1, BADGE_2]);
      repository.awardBadges.mockResolvedValue({ count: 1 });
    });

    it('attribue les badges dont les critères sont remplis', async () => {
      const result = await service.processBadgesAfterDonation('user-1');

      expect(repository.awardBadges).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining(['badge-1']),
      );
      expect(events.emitToUser).toHaveBeenCalledWith(
        'user-1',
        'badges:earned',
        expect.objectContaining({ badges: expect.any(Array) }),
      );
      expect(result).toContainEqual(expect.objectContaining({ id: 'badge-1' }));
    });

    it("n'attribue pas les badges déjà obtenus", async () => {
      repository.findUserBadges.mockResolvedValue([USER_BADGE_1]);

      await service.processBadgesAfterDonation('user-1');

      expect(repository.awardBadges).not.toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining(['badge-1']),
      );
    });

    it("n'attribue pas les badges dont les critères ne sont pas remplis", async () => {
      const result = await service.processBadgesAfterDonation('user-1');

      expect(result.find((b) => b.id === 'badge-2')).toBeUndefined();
    });

    it('envoie une push notification si expoPushToken est présent', async () => {
      repository.findUserForBadgeNotification.mockResolvedValue({
        bloodType: 'O_NEG',
        expoPushToken: 'ExponentPushToken[xxx]',
      });

      await service.processBadgesAfterDonation('user-1');

      expect(push.sendToOne).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'ExponentPushToken[xxx]',
          title: '🏆 Nouveau badge débloqué !',
        }),
      );
    });

    it("ne tente pas d'envoyer une push si pas de token", async () => {
      repository.findUserForBadgeNotification.mockResolvedValue({
        bloodType: 'O_NEG',
        expoPushToken: null,
      });

      await service.processBadgesAfterDonation('user-1');

      expect(push.sendToOne).not.toHaveBeenCalled();
    });

    it('retourne un tableau vide si aucun badge à attribuer', async () => {
      repository.findUserBadges.mockResolvedValue([USER_BADGE_1]);
      repository.findAllBadges.mockResolvedValue([BADGE_1]);

      const result = await service.processBadgesAfterDonation('user-1');

      expect(result).toEqual([]);
      expect(repository.awardBadges).not.toHaveBeenCalled();
    });

    it('retourne un tableau vide si le profil est introuvable', async () => {
      repository.findByUserId.mockResolvedValue(null);

      const result = await service.processBadgesAfterDonation('inexistant');

      expect(result).toEqual([]);
      expect(repository.awardBadges).not.toHaveBeenCalled();
    });
  });
});

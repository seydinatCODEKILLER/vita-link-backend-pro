import { Test, TestingModule } from '@nestjs/testing';
import { JambaarsRepository } from './jambaar-profile.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  jambaarsProfile: {
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  userBadge: {
    findMany: jest.fn(),
    createMany: jest.fn(),
  },
  badge: {
    findMany: jest.fn(),
  },
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

const BADGE = {
  id: 'badge-1',
  name: 'Premier Pas',
  description: 'Premier don effectué',
  iconUrl: null,
  criteria: '{"minDonations":1}',
  isSeasonal: false,
  season: null,
};

const USER_BADGE = {
  earnedAt: new Date('2026-02-01'),
  badge: BADGE,
};

describe('JambaarsRepository', () => {
  let repository: JambaarsRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JambaarsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(JambaarsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByUserId', () => {
    it('retourne le profil complet', async () => {
      prisma.jambaarsProfile.findUnique.mockResolvedValue(PROFILE);

      const result = await repository.findByUserId('user-1');

      expect(prisma.jambaarsProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: expect.objectContaining({ id: true, totalPoints: true }),
      });
      expect(result).toEqual(PROFILE);
    });

    it('retourne null si le profil est introuvable', async () => {
      prisma.jambaarsProfile.findUnique.mockResolvedValue(null);

      const result = await repository.findByUserId('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findUserForBadgeNotification', () => {
    it('retourne bloodType et expoPushToken', async () => {
      const userData = {
        bloodType: 'O_NEG',
        expoPushToken: 'ExponentPushToken[xxx]',
      };
      prisma.user.findUnique.mockResolvedValue(userData);

      const result = await repository.findUserForBadgeNotification('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { bloodType: true, expoPushToken: true },
      });
      expect(result).toEqual(userData);
    });
  });

  describe('findUserBadges', () => {
    it('retourne les badges gagnés triés par earnedAt desc', async () => {
      prisma.userBadge.findMany.mockResolvedValue([USER_BADGE]);

      const result = await repository.findUserBadges('user-1');

      expect(prisma.userBadge.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: expect.objectContaining({ earnedAt: true }),
        orderBy: { earnedAt: 'desc' },
      });
      expect(result).toEqual([USER_BADGE]);
    });
  });

  describe('findAllBadges', () => {
    it('retourne tous les badges actifs triés par createdAt asc', async () => {
      prisma.badge.findMany.mockResolvedValue([BADGE]);

      const result = await repository.findAllBadges();

      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.objectContaining({
          id: true,
          name: true,
          criteria: true,
        }),
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([BADGE]);
    });
  });

  describe('awardBadges', () => {
    it('crée les userBadge en ignorant les doublons', async () => {
      prisma.userBadge.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.awardBadges('user-1', [
        'badge-1',
        'badge-2',
      ]);

      expect(prisma.userBadge.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'user-1', badgeId: 'badge-1' },
          { userId: 'user-1', badgeId: 'badge-2' },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual({ count: 2 });
    });
  });

  describe('getUserRank', () => {
    it('retourne le rang global du donneur', async () => {
      prisma.jambaarsProfile.findUnique.mockResolvedValue({
        totalPoints: 620,
        donationCount: 3,
      });
      prisma.jambaarsProfile.count.mockResolvedValue(5);

      const result = await repository.getUserRank('user-1');

      expect(result).toBe(6);
    });

    it('retourne null si le profil est introuvable', async () => {
      prisma.jambaarsProfile.findUnique.mockResolvedValue(null);

      const result = await repository.getUserRank('inexistant');

      expect(result).toBeNull();
    });

    it('filtre par ville si city est fourni', async () => {
      prisma.jambaarsProfile.findUnique.mockResolvedValue({
        totalPoints: 620,
        donationCount: 3,
      });
      prisma.jambaarsProfile.count.mockResolvedValue(2);

      const result = await repository.getUserRank('user-1', { city: 'Dakar' });

      expect(prisma.jambaarsProfile.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: { equals: 'Dakar', mode: 'insensitive' },
          }),
        }),
      );
      expect(result).toBe(3);
    });

    it('filtre par district si district est fourni (prioritaire sur city)', async () => {
      prisma.jambaarsProfile.findUnique.mockResolvedValue({
        totalPoints: 620,
        donationCount: 3,
      });
      prisma.jambaarsProfile.count.mockResolvedValue(1);

      await repository.getUserRank('user-1', {
        city: 'Dakar',
        district: 'Plateau',
      });

      expect(prisma.jambaarsProfile.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            district: { equals: 'Plateau', mode: 'insensitive' },
          }),
        }),
      );
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './users.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  alertResponse: {
    findFirst: jest.fn(),
  },
});

const ME_DATA = {
  id: 'user-1',
  email: 'aliou@gmail.com',
  phone: '+221771234567',
  firstName: 'Aliou',
  lastName: 'Diallo',
  role: 'DONOR',
  gender: 'MALE',
  dateOfBirth: null,
  avatarUrl: null,
  bloodType: 'O_NEG',
  isAvailable: true,
  isActive: true,
  latitude: 14.6937,
  longitude: -17.4441,
  healthStructureId: null,
  isStructureAdmin: false,
  createdAt: new Date('2026-01-01'),
  jambaarsProfile: {
    totalPoints: 150,
    currentGrade: 'SENTINELLE',
    donationCount: 3,
    livesSavedEstimate: 9,
    lastDonationAt: null,
    nextEligibilityAt: null,
    city: 'Dakar',
    district: 'Plateau',
  },
  employerStructure: null,
};

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(UsersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findMe', () => {
    it("retourne le profil complet de l'utilisateur", async () => {
      prisma.user.findUnique.mockResolvedValue(ME_DATA);

      const result = await repository.findMe('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          jambaarsProfile: expect.any(Object),
        }),
      });
      expect(result).toEqual(ME_DATA);
    });

    it("retourne null si l'utilisateur est introuvable", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findMe('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('met à jour le profil avec les données fournies', async () => {
      const data = { firstName: 'Moussa', bloodType: 'A_POS' };
      prisma.user.update.mockResolvedValue({ ...ME_DATA, ...data });

      const result = await repository.updateProfile('user-1', data);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data,
        select: expect.objectContaining({ id: true, firstName: true }),
      });
      expect(result).toEqual({ ...ME_DATA, ...data });
    });
  });

  describe('updateAvatar', () => {
    it('met à jour avatarUrl et retourne le select réduit', async () => {
      const avatarResult = {
        id: 'user-1',
        avatarUrl:
          'https://res.cloudinary.com/vita-link/avatars/avatar_user-1.jpg',
      };
      prisma.user.update.mockResolvedValue(avatarResult);

      const result = await repository.updateAvatar(
        'user-1',
        avatarResult.avatarUrl,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { avatarUrl: avatarResult.avatarUrl },
        select: { id: true, avatarUrl: true },
      });
      expect(result).toEqual(avatarResult);
    });
  });

  describe('updateLocation', () => {
    it('met à jour latitude et longitude', async () => {
      const locationResult = {
        id: 'user-1',
        latitude: 14.6937,
        longitude: -17.4441,
      };
      prisma.user.update.mockResolvedValue(locationResult);

      const result = await repository.updateLocation(
        'user-1',
        14.6937,
        -17.4441,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { latitude: 14.6937, longitude: -17.4441 },
        select: { id: true, latitude: true, longitude: true },
      });
      expect(result).toEqual(locationResult);
    });
  });

  describe('updateAvailability', () => {
    it('met à jour isAvailable et retourne le select réduit', async () => {
      const availResult = { id: 'user-1', isAvailable: false };
      prisma.user.update.mockResolvedValue(availResult);

      const result = await repository.updateAvailability('user-1', false);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isAvailable: false },
        select: { id: true, isAvailable: true },
      });
      expect(result).toEqual(availResult);
    });
  });

  describe('updateExpoToken', () => {
    it('met à jour expoPushToken et retourne le select réduit', async () => {
      const tokenResult = {
        id: 'user-1',
        expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      };
      prisma.user.update.mockResolvedValue(tokenResult);

      const result = await repository.updateExpoToken(
        'user-1',
        'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' },
        select: { id: true, expoPushToken: true },
      });
      expect(result).toEqual(tokenResult);
    });
  });

  describe('softDelete', () => {
    it("anonymise les données personnelles et retourne uniquement l'id", async () => {
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await repository.softDelete('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          email: null,
          phone: `DELETED_user-1`,
          firstName: 'Compte',
          lastName: 'Supprimé',
          avatarUrl: null,
          isActive: false,
          isAvailable: false,
          expoPushToken: null,
        }),
        select: { id: true },
      });
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('findActiveEngagement', () => {
    it("retourne l'engagement actif du donneur", async () => {
      const engagement = {
        id: 'response-1',
        qrCode: 'data:image/png;base64,...',
        etaMinutes: 15,
        alert: {
          id: 'alert-1',
          bloodType: 'O_NEG',
          urgencyLevel: 'VITAL',
          status: 'ACTIVE',
          origin: 'MANUAL',
          healthStructure: {
            id: 'structure-1',
            name: 'Hôpital Principal',
            address: 'Avenue Cheikh Anta Diop',
          },
        },
      };
      prisma.alertResponse.findFirst.mockResolvedValue(engagement);

      const result = await repository.findActiveEngagement('user-1');

      expect(prisma.alertResponse.findFirst).toHaveBeenCalledWith({
        where: {
          donorId: 'user-1',
          status: 'CONFIRMED',
          alert: { status: { in: ['ACTIVE', 'QUOTA_REACHED'] } },
        },
        select: expect.objectContaining({ id: true, qrCode: true }),
      });
      expect(result).toEqual(engagement);
    });

    it('retourne null si aucun engagement actif', async () => {
      prisma.alertResponse.findFirst.mockResolvedValue(null);

      const result = await repository.findActiveEngagement('user-1');

      expect(result).toBeNull();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepository } from './auth.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { Role, BloodType, Gender } from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
});

const DONOR_SELECT_RESULT = {
  id: 'donor-1',
  email: 'aliou@gmail.com',
  phone: '+221771234567',
  firstName: 'Aliou',
  lastName: 'Diallo',
  role: Role.DONOR,
  bloodType: BloodType.O_NEG,
  gender: Gender.MALE,
  isActive: true,
  isAvailable: true,
  jambaarsProfile: {
    totalPoints: 0,
    currentGrade: 'ASPIRANT',
    donationCount: 0,
    nextEligibilityAt: null,
    lastDonationAt: null,
  },
};

const FULL_USER = {
  id: 'user-1',
  email: 'dr.sow@hpd.sn',
  phone: '+221771234567',
  passwordHash: 'hashed',
  role: Role.HOSPITAL_AGENT,
  firstName: 'Moussa',
  lastName: 'Sow',
  isActive: true,
};

describe('AuthRepository', () => {
  let repository: AuthRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repository = module.get(AuthRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it("retourne l'utilisateur correspondant à l'email", async () => {
      prisma.user.findUnique.mockResolvedValue(FULL_USER);

      const result = await repository.findByEmail('dr.sow@hpd.sn');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'dr.sow@hpd.sn' },
      });
      expect(result).toEqual(FULL_USER);
    });

    it('retourne null si aucun utilisateur ne correspond', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('inconnu@hpd.sn');

      expect(result).toBeNull();
    });
  });

  describe('findByPhone', () => {
    it("retourne l'utilisateur correspondant au téléphone", async () => {
      prisma.user.findUnique.mockResolvedValue(FULL_USER);

      const result = await repository.findByPhone('+221771234567');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+221771234567' },
      });
      expect(result).toEqual(FULL_USER);
    });
  });

  describe('findByRefreshToken', () => {
    it("retourne l'utilisateur correspondant au refresh token", async () => {
      prisma.user.findUnique.mockResolvedValue(FULL_USER);

      const result = await repository.findByRefreshToken('refresh-token-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { refreshToken: 'refresh-token-1' },
      });
      expect(result).toEqual(FULL_USER);
    });

    it('retourne null si le refresh token est inconnu ou révoqué', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByRefreshToken('token-invalide');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailWithRole', () => {
    it('retourne le sous-ensemble de champs attendu (id, email, role, isActive, firstName)', async () => {
      const partial = {
        id: 'user-1',
        email: 'dr.sow@hpd.sn',
        role: Role.HOSPITAL_AGENT,
        isActive: true,
        firstName: 'Moussa',
      };
      prisma.user.findUnique.mockResolvedValue(partial);

      const result = await repository.findByEmailWithRole('dr.sow@hpd.sn');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'dr.sow@hpd.sn' },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          firstName: true,
        },
      });
      expect(result).toEqual(partial);
    });
  });

  describe('findDonorByEmail', () => {
    it('retourne le donneur avec son profil Jambaar', async () => {
      prisma.user.findUnique.mockResolvedValue(DONOR_SELECT_RESULT);

      const result = await repository.findDonorByEmail('aliou@gmail.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'aliou@gmail.com' },
        select: expect.objectContaining({
          id: true,
          jambaarsProfile: expect.any(Object),
        }),
      });
      expect(result).toEqual(DONOR_SELECT_RESULT);
    });

    it('retourne null si aucun donneur ne correspond', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findDonorByEmail('inconnu@gmail.com');

      expect(result).toBeNull();
    });
  });

  describe('storeRefreshToken', () => {
    it('met à jour le refreshToken et sa date d’expiration', async () => {
      const expiresAt = new Date('2026-07-25T10:00:00');
      prisma.user.update.mockResolvedValue({
        ...FULL_USER,
        refreshToken: 'rt',
      });

      const result = await repository.storeRefreshToken(
        'user-1',
        'rt',
        expiresAt,
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: 'rt', refreshTokenExpiresAt: expiresAt },
      });
      expect(result.refreshToken).toBe('rt');
    });
  });

  describe('revokeRefreshToken', () => {
    it('met le refreshToken et sa date d’expiration à null', async () => {
      prisma.user.update.mockResolvedValue({
        ...FULL_USER,
        refreshToken: null,
        refreshTokenExpiresAt: null,
      });

      await repository.revokeRefreshToken('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null, refreshTokenExpiresAt: null },
      });
    });
  });

  describe('createDonor', () => {
    beforeEach(() => {
      prisma.user.create.mockResolvedValue(DONOR_SELECT_RESULT);
    });

    it('crée le donneur avec le rôle DONOR et un profil Jambaar initialisé', async () => {
      const data = {
        email: 'aliou@gmail.com',
        phone: '+221771234567',
        firstName: 'Aliou',
        lastName: 'Diallo',
        bloodType: BloodType.O_NEG,
        gender: Gender.MALE,
        dateOfBirth: '1995-06-15',
      };

      const result = await repository.createDonor(data);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'aliou@gmail.com',
          phone: '+221771234567',
          firstName: 'Aliou',
          lastName: 'Diallo',
          bloodType: BloodType.O_NEG,
          gender: Gender.MALE,
          dateOfBirth: new Date('1995-06-15'),
          role: 'DONOR',
          isActive: true,
          isAvailable: true,
          jambaarsProfile: {
            create: {
              totalPoints: 0,
              currentGrade: 'ASPIRANT',
              donationCount: 0,
            },
          },
        },
        select: expect.objectContaining({
          id: true,
          jambaarsProfile: expect.any(Object),
        }),
      });
      expect(result).toEqual(DONOR_SELECT_RESULT);
    });

    it('laisse dateOfBirth undefined si non fourni', async () => {
      const data = {
        email: 'aliou@gmail.com',
        phone: '+221771234567',
        firstName: 'Aliou',
        lastName: 'Diallo',
        gender: Gender.MALE,
      };

      await repository.createDonor(data);

      const callArgs = prisma.user.create.mock.calls[0][0];
      expect(callArgs.data.dateOfBirth).toBeUndefined();
    });

    it('laisse bloodType undefined si non fourni', async () => {
      const data = {
        email: 'aliou@gmail.com',
        phone: '+221771234567',
        firstName: 'Aliou',
        lastName: 'Diallo',
        gender: Gender.MALE,
      };

      await repository.createDonor(data);

      const callArgs = prisma.user.create.mock.calls[0][0];
      expect(callArgs.data.bloodType).toBeUndefined();
    });
  });
});

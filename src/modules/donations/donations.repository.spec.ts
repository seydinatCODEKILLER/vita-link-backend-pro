import { Test, TestingModule } from '@nestjs/testing';
import { DonationsRepository } from './donations.repository';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BloodType,
  DonorGrade,
  AlertResponseStatus,
  BloodStockLevel,
} from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  donation: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  alertResponse: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  healthStructure: {
    findUnique: jest.fn(),
  },
  jambaarsProfile: {
    upsert: jest.fn(),
  },
  bloodStock: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
});

const ALERT_RESPONSE = {
  id: 'response-1',
  alertId: 'alert-1',
  donorId: 'donor-1',
  status: 'CONFIRMED',
  etaMinutes: 15,
  respondedAt: new Date('2026-06-25'),
  donation: null,
  alert: {
    id: 'alert-1',
    bloodType: BloodType.O_NEG,
    urgencyLevel: 'VITAL',
    healthStructureId: 'structure-1',
  },
  donor: {
    id: 'donor-1',
    gender: 'MALE',
    jambaarsProfile: {
      id: 'profile-1',
      totalPoints: 500,
      currentGrade: 'SENTINELLE',
      donationCount: 3,
    },
  },
};

const DONATION_DETAIL = {
  id: 'donation-1',
  isDone: true,
  pointsAwarded: 170,
  donatedAt: new Date('2026-06-25'),
  validatedAt: new Date('2026-06-25'),
  notes: 'Don sans incident',
  testResultsJson: null,
  healthStructure: { id: 'structure-1', name: 'Hôpital Principal' },
  alertResponse: null,
  donor: {
    id: 'donor-1',
    firstName: 'Awa',
    lastName: 'Diop',
    bloodType: BloodType.O_NEG,
    avatarUrl: null,
    phone: '+221770000000',
    jambaarsProfile: {
      id: 'profile-1',
      totalPoints: 670,
      currentGrade: 'AMBASSADEUR',
      donationCount: 4,
      livesSavedEstimate: 12,
      nextEligibilityAt: new Date('2026-09-23'),
    },
  },
  validatedBy: { id: 'agent-1', firstName: 'Moussa', lastName: 'Fall' },
};

describe('DonationsRepository', () => {
  let repository: DonationsRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(DonationsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAlertResponseByQrCode', () => {
    it("retourne la réponse à l'alerte avec le select complet", async () => {
      prisma.alertResponse.findFirst.mockResolvedValue(ALERT_RESPONSE);

      const result =
        await repository.findAlertResponseByQrCode('VITA-X9K2-M4P7');

      expect(prisma.alertResponse.findFirst).toHaveBeenCalledWith({
        where: { qrCode: 'VITA-X9K2-M4P7' },
        select: expect.objectContaining({
          id: true,
          donorId: true,
          donation: expect.any(Object),
          alert: expect.any(Object),
          donor: expect.any(Object),
        }),
      });
      expect(result).toEqual(ALERT_RESPONSE);
    });

    it('retourne null si le QR Code est introuvable', async () => {
      prisma.alertResponse.findFirst.mockResolvedValue(null);

      const result =
        await repository.findAlertResponseByQrCode('VITA-XXXX-XXXX');

      expect(result).toBeNull();
    });
  });

  describe('findUserPushToken', () => {
    it('retourne le token expo et le prénom', async () => {
      prisma.user.findUnique.mockResolvedValue({
        expoPushToken: 'ExponentPushToken[xxx]',
        firstName: 'Awa',
      });

      const result = await repository.findUserPushToken('donor-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'donor-1' },
        select: { expoPushToken: true, firstName: true },
      });
      expect(result).toEqual({
        expoPushToken: 'ExponentPushToken[xxx]',
        firstName: 'Awa',
      });
    });
  });

  describe('findStructureById', () => {
    it('retourne la structure avec affiliatedCntsId et structureType', async () => {
      prisma.healthStructure.findUnique.mockResolvedValue({
        id: 'structure-1',
        affiliatedCntsId: 'cnts-1',
        structureType: 'HOSPITAL',
      });

      const result = await repository.findStructureById('structure-1');

      expect(prisma.healthStructure.findUnique).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        select: { id: true, affiliatedCntsId: true, structureType: true },
      });
      expect(result?.affiliatedCntsId).toBe('cnts-1');
    });
  });

  describe('findDonationById', () => {
    it('retourne le don avec le select detail complet', async () => {
      prisma.donation.findUnique.mockResolvedValue(DONATION_DETAIL);

      const result = await repository.findDonationById('donation-1');

      expect(prisma.donation.findUnique).toHaveBeenCalledWith({
        where: { id: 'donation-1' },
        select: expect.objectContaining({
          id: true,
          donor: expect.any(Object),
          validatedBy: expect.any(Object),
        }),
      });
      expect(result).toEqual(DONATION_DETAIL);
    });

    it('retourne null si le don est introuvable', async () => {
      prisma.donation.findUnique.mockResolvedValue(null);

      const result = await repository.findDonationById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('validateDonation', () => {
    it('exécute la transaction et retourne le don avec le profil mis à jour', async () => {
      const updatedProfile = {
        id: 'profile-1',
        totalPoints: 670,
        currentGrade: DonorGrade.AMBASSADEUR,
        donationCount: 4,
        livesSavedEstimate: 12,
        nextEligibilityAt: new Date('2026-09-23'),
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          donation: { create: jest.fn().mockResolvedValue(DONATION_DETAIL) },
          alertResponse: { update: jest.fn().mockResolvedValue({}) },
          jambaarsProfile: {
            upsert: jest.fn().mockResolvedValue(updatedProfile),
          },
          bloodStock: { upsert: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await repository.validateDonation({
        alertResponseId: 'response-1',
        donorId: 'donor-1',
        healthStructureId: 'structure-1',
        stockStructureId: 'cnts-1',
        validatedByUserId: 'agent-1',
        bloodType: BloodType.O_NEG,
        pointsAwarded: 170,
        newGrade: DonorGrade.AMBASSADEUR,
        nextEligibilityAt: new Date('2026-09-23'),
        notes: 'Don sans incident',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.donor.jambaarsProfile).toEqual(updatedProfile);
    });

    it('met à jour alertResponse avec ARRIVED dans la transaction', async () => {
      const alertResponseUpdate = jest.fn().mockResolvedValue({});

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          donation: { create: jest.fn().mockResolvedValue(DONATION_DETAIL) },
          alertResponse: { update: alertResponseUpdate },
          jambaarsProfile: { upsert: jest.fn().mockResolvedValue({}) },
          bloodStock: { upsert: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      await repository.validateDonation({
        alertResponseId: 'response-1',
        donorId: 'donor-1',
        healthStructureId: 'structure-1',
        stockStructureId: 'cnts-1',
        validatedByUserId: 'agent-1',
        bloodType: BloodType.O_NEG,
        pointsAwarded: 170,
        newGrade: DonorGrade.AMBASSADEUR,
        nextEligibilityAt: new Date('2026-09-23'),
      });

      expect(alertResponseUpdate).toHaveBeenCalledWith({
        where: { id: 'response-1' },
        data: {
          status: AlertResponseStatus.ARRIVED,
          arrivedAt: expect.any(Date),
        },
      });
    });

    it('incrémente le stock de sang dans la transaction', async () => {
      const bloodStockUpsert = jest.fn().mockResolvedValue({});

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          donation: { create: jest.fn().mockResolvedValue(DONATION_DETAIL) },
          alertResponse: { update: jest.fn().mockResolvedValue({}) },
          jambaarsProfile: { upsert: jest.fn().mockResolvedValue({}) },
          bloodStock: { upsert: bloodStockUpsert },
        };
        return cb(tx);
      });

      await repository.validateDonation({
        alertResponseId: 'response-1',
        donorId: 'donor-1',
        healthStructureId: 'structure-1',
        stockStructureId: 'cnts-1',
        validatedByUserId: 'agent-1',
        bloodType: BloodType.O_NEG,
        pointsAwarded: 170,
        newGrade: DonorGrade.AMBASSADEUR,
        nextEligibilityAt: new Date('2026-09-23'),
      });

      expect(bloodStockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            healthStructureId_bloodType: {
              healthStructureId: 'cnts-1',
              bloodType: BloodType.O_NEG,
            },
          },
          update: { quantity: { increment: 1 } },
          create: expect.objectContaining({
            quantity: 1,
            level: BloodStockLevel.ADEQUATE,
          }),
        }),
      );
    });
  });
});

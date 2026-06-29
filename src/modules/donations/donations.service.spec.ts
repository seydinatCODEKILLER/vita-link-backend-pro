import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationsRepository } from './donations.repository';
import { JambaarsService } from '@/modules/jambaar-profile/jambaar-profile.service';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import {
  BloodType,
  DonorGrade,
  HealthStructureStatus,
  Role,
  StructureType,
} from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { ScanDonationDto } from './dto/scan-donation.dto';

const createMockRepository = () => ({
  findAlertResponseByQrCode: jest.fn(),
  findUserPushToken: jest.fn(),
  findStructureById: jest.fn(),
  validateDonation: jest.fn(),
  findDonationById: jest.fn(),
  findMyDonations: jest.fn(),
  findStructureDonations: jest.fn(),
});

const createMockJambaarsService = () => ({
  processBadgesAfterDonation: jest.fn().mockResolvedValue([]),
});

const createMockEventsService = () => ({
  emitToUser: jest.fn(),
  emitToStructure: jest.fn(),
  emitToAlert: jest.fn(),
});

const createMockPushService = () => ({
  sendToOne: jest.fn().mockResolvedValue(undefined),
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

const DONATION_RESULT = {
  id: 'donation-1',
  isDone: true,
  pointsAwarded: 170,
  donatedAt: new Date('2026-06-25'),
  validatedAt: new Date('2026-06-25'),
  notes: 'Don sans incident',
  testResultsJson: null,
  healthStructure: { id: 'structure-1', name: 'Hôpital Principal' },
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
      currentGrade: DonorGrade.AMBASSADEUR,
      donationCount: 4,
      livesSavedEstimate: 12,
      nextEligibilityAt: new Date('2026-09-23'),
    },
  },
  validatedBy: { id: 'agent-1', firstName: 'Moussa', lastName: 'Fall' },
};

const DONATION_SUMMARY = {
  id: 'donation-1',
  isDone: true,
  pointsAwarded: 170,
  donatedAt: new Date('2026-06-25'),
  validatedAt: new Date('2026-06-25'),
  notes: null,
  healthStructure: { id: 'structure-1', name: 'Hôpital Principal' },
  alertResponse: null,
};

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'agent-1',
  firstName: 'Moussa',
  lastName: 'Fall',
  email: 'moussa@cnts.sn',
  role: Role.CNTS_AGENT,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'structure-1',
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
  employerStructure: {
    id: 'structure-1',
    name: 'CNTS de Dakar',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Route de Rufisque',
    latitude: null,
    longitude: null,
    structureType: StructureType.CNTS,
    affiliatedCntsId: null,
  },
  ...overrides,
});

const CNTS_AGENT = makeUser();

const HOSPITAL_AGENT = makeUser({
  id: 'hospital-agent-1',
  role: Role.HOSPITAL_AGENT,
  healthStructureId: 'hospital-1',
  employerStructure: {
    id: 'hospital-1',
    name: 'Hôpital Principal',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Avenue Nelson Mandela',
    latitude: null,
    longitude: null,
    structureType: StructureType.HOSPITAL,
    affiliatedCntsId: 'cnts-1',
  },
});

const ADMIN_USER = makeUser({
  id: 'admin-1',
  role: Role.ADMIN,
  healthStructureId: null,
  employerStructure: null,
});

const DONOR_USER = makeUser({
  id: 'donor-1',
  role: Role.DONOR,
  healthStructureId: null,
  employerStructure: null,
});

const SCAN_DTO: ScanDonationDto = {
  qrCode: 'VITA-X9K2-M4P7',
  notes: 'Don sans incident',
};

describe('DonationsService', () => {
  let service: DonationsService;
  let repository: ReturnType<typeof createMockRepository>;
  let jambaarsService: ReturnType<typeof createMockJambaarsService>;
  let events: ReturnType<typeof createMockEventsService>;
  let push: ReturnType<typeof createMockPushService>;

  beforeEach(async () => {
    repository = createMockRepository();
    jambaarsService = createMockJambaarsService();
    events = createMockEventsService();
    push = createMockPushService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: DonationsRepository, useValue: repository },
        { provide: JambaarsService, useValue: jambaarsService },
        { provide: EventsService, useValue: events },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get(DonationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scanAndValidate', () => {
    beforeEach(() => {
      repository.findAlertResponseByQrCode.mockResolvedValue(ALERT_RESPONSE);
      repository.validateDonation.mockResolvedValue(DONATION_RESULT);
      repository.findUserPushToken.mockResolvedValue({
        expoPushToken: null,
        firstName: 'Awa',
      });
    });

    it('valide le don et émet les événements', async () => {
      const result = await service.scanAndValidate(SCAN_DTO, CNTS_AGENT);

      expect(repository.validateDonation).toHaveBeenCalledWith(
        expect.objectContaining({
          alertResponseId: 'response-1',
          donorId: 'donor-1',
          validatedByUserId: 'agent-1',
          bloodType: BloodType.O_NEG,
        }),
      );
      expect(events.emitToUser).toHaveBeenCalledWith(
        'donor-1',
        'donation:validated',
        expect.objectContaining({ donationId: 'donation-1' }),
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        expect.any(String),
        'stock:updated',
        expect.objectContaining({ bloodType: BloodType.O_NEG }),
      );
      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'response:arrived',
        expect.objectContaining({ donationId: 'donation-1' }),
      );
      expect(result.donation).toEqual(DONATION_RESULT);
      expect(result.jambaar.pointsAwarded).toBeGreaterThan(0);
    });

    it('utilise affiliatedCntsId comme stockStructureId pour un hôpital', async () => {
      repository.findAlertResponseByQrCode.mockResolvedValue({
        ...ALERT_RESPONSE,
        alert: { ...ALERT_RESPONSE.alert, healthStructureId: 'hospital-1' },
      });
      repository.findStructureById.mockResolvedValue({
        id: 'hospital-1',
        affiliatedCntsId: 'cnts-1',
        structureType: StructureType.HOSPITAL,
      });

      await service.scanAndValidate(SCAN_DTO, HOSPITAL_AGENT);

      expect(repository.validateDonation).toHaveBeenCalledWith(
        expect.objectContaining({ stockStructureId: 'cnts-1' }),
      );
    });

    it('utilise healthStructureId comme stockStructureId pour une CNTS', async () => {
      await service.scanAndValidate(SCAN_DTO, CNTS_AGENT);

      expect(repository.validateDonation).toHaveBeenCalledWith(
        expect.objectContaining({ stockStructureId: 'structure-1' }),
      );
      expect(repository.findStructureById).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le QR Code est introuvable', async () => {
      repository.findAlertResponseByQrCode.mockResolvedValue(null);

      await expect(
        service.scanAndValidate(SCAN_DTO, CNTS_AGENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le QR Code a déjà été utilisé', async () => {
      repository.findAlertResponseByQrCode.mockResolvedValue({
        ...ALERT_RESPONSE,
        donation: { id: 'existing-donation' },
      });

      await expect(
        service.scanAndValidate(SCAN_DTO, CNTS_AGENT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le donneur a décliné', async () => {
      repository.findAlertResponseByQrCode.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: 'DECLINED',
      });

      await expect(
        service.scanAndValidate(SCAN_DTO, CNTS_AGENT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si le donneur est NO_SHOW', async () => {
      repository.findAlertResponseByQrCode.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: 'NO_SHOW',
      });

      await expect(
        service.scanAndValidate(SCAN_DTO, CNTS_AGENT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève ForbiddenException si le QR Code appartient à une autre structure', async () => {
      const otherAgent = makeUser({ healthStructureId: 'autre-structure' });

      await expect(
        service.scanAndValidate(SCAN_DTO, otherAgent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ne lève pas ForbiddenException pour un admin même avec une structure différente', async () => {
      await expect(
        service.scanAndValidate(SCAN_DTO, ADMIN_USER),
      ).resolves.toBeDefined();
    });
  });

  describe('getMyDonations', () => {
    it('retourne les dons paginés avec les valeurs par défaut', async () => {
      repository.findMyDonations.mockResolvedValue({
        data: [DONATION_SUMMARY],
        total: 1,
      });

      const result = await service.getMyDonations('donor-1', {});

      expect(repository.findMyDonations).toHaveBeenCalledWith('donor-1', {
        page: 1,
        limit: 20,
      });
      expect(result.donations).toEqual([DONATION_SUMMARY]);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('calcule correctement totalPages', async () => {
      repository.findMyDonations.mockResolvedValue({ data: [], total: 45 });

      const result = await service.getMyDonations('donor-1', {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('getDonationById', () => {
    it('retourne le don pour un agent', async () => {
      repository.findDonationById.mockResolvedValue(DONATION_RESULT);

      const result = await service.getDonationById('donation-1', CNTS_AGENT);

      expect(result).toEqual(DONATION_RESULT);
    });

    it('retourne le don pour un donneur qui consulte le sien', async () => {
      repository.findDonationById.mockResolvedValue(DONATION_RESULT);

      const result = await service.getDonationById('donation-1', DONOR_USER);

      expect(result).toEqual(DONATION_RESULT);
    });

    it("lève ForbiddenException si un donneur consulte le don d'un autre", async () => {
      repository.findDonationById.mockResolvedValue(DONATION_RESULT);

      const otherDonor = makeUser({
        id: 'autre-donor',
        role: Role.DONOR,
        healthStructureId: null,
        employerStructure: null,
      });

      await expect(
        service.getDonationById('donation-1', otherDonor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le don est introuvable', async () => {
      repository.findDonationById.mockResolvedValue(null);

      await expect(
        service.getDonationById('inexistant', CNTS_AGENT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStructureDonations', () => {
    it('retourne les dons de la structure', async () => {
      repository.findStructureDonations.mockResolvedValue({
        data: [DONATION_RESULT],
        total: 1,
      });

      const result = await service.getStructureDonations(CNTS_AGENT, {});

      expect(repository.findStructureDonations).toHaveBeenCalledWith(
        'structure-1',
        { page: 1, limit: 20 },
      );
      expect(result.donations).toEqual([DONATION_RESULT]);
    });

    it("lève ForbiddenException si l'utilisateur n'a pas de structure", async () => {
      await expect(
        service.getStructureDonations(ADMIN_USER, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('calcule correctement totalPages', async () => {
      repository.findStructureDonations.mockResolvedValue({
        data: [],
        total: 45,
      });

      const result = await service.getStructureDonations(CNTS_AGENT, {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.totalPages).toBe(3);
    });
  });
});

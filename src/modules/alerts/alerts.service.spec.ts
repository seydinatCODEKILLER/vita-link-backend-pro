import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsRepository } from './alerts.repository';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import {
  AlertOrigin,
  AlertStatus,
  BloodType,
  HealthStructureStatus,
  Role,
  StructureType,
  UrgencyLevel,
} from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { CreateAlertDto } from './dto/create-alert.dto';

const createMockRepository = () => ({
  createAlert: jest.fn(),
  findByIdWithDetails: jest.fn(),
  findNearbyActive: jest.fn(),
  findNearbyDonors: jest.fn(),
  findByStructure: jest.fn(),
  findResponses: jest.fn(),
  incrementConfirmed: jest.fn(),
  decrementConfirmed: jest.fn(),
  closeAlert: jest.fn(),
  expireStaleAlerts: jest.fn(),
});

const createMockEventsService = () => ({
  emitToUser: jest.fn(),
  emitToStructure: jest.fn(),
  emitToAlert: jest.fn(),
});

const createMockPushService = () => ({
  sendMulticast: jest.fn().mockResolvedValue(undefined),
});

const ALERT_DETAIL = {
  id: 'alert-1',
  bloodType: BloodType.O_NEG,
  quantityNeeded: 2,
  quantityConfirmed: 0,
  urgencyLevel: 'VITAL',
  status: AlertStatus.ACTIVE,
  origin: AlertOrigin.HOSPITAL_DIRECT,
  bloodRequestId: null,
  serviceUnit: 'EMERGENCY_ROOM',
  address: 'Avenue Nelson Mandela',
  latitude: 14.6937,
  longitude: -17.4441,
  radiusKm: 10,
  expiresAt: new Date('2026-06-25T11:00:00'),
  createdAt: new Date('2026-06-25T10:00:00'),
  closedAt: null,
  updatedAt: new Date('2026-06-25T10:00:00'),
  healthStructure: {
    id: 'structure-1',
    name: 'Hôpital Principal',
    structureType: 'HOSPITAL',
    address: 'Avenue Nelson Mandela',
    latitude: 14.6937,
    longitude: -17.4441,
  },
  createdBy: { id: 'agent-1', firstName: 'Moussa', lastName: 'Fall' },
  _count: { alertResponses: 0 },
};

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'agent-1',
  firstName: 'Moussa',
  lastName: 'Fall',
  email: 'moussa@hopital.sn',
  role: Role.HOSPITAL_AGENT,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'structure-1',
  isStructureAdmin: false,
  latitude: 14.6937,
  longitude: -17.4441,
  employerStructure: {
    id: 'structure-1',
    name: 'Hôpital Principal',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Avenue Nelson Mandela',
    latitude: 14.6937,
    longitude: -17.4441,
    structureType: StructureType.HOSPITAL,
    affiliatedCntsId: 'cnts-1',
  },
  ...overrides,
});

const HOSPITAL_AGENT = makeUser();

const CNTS_AGENT = makeUser({
  id: 'cnts-agent-1',
  role: Role.CNTS_AGENT,
  healthStructureId: 'cnts-1',
  employerStructure: {
    id: 'cnts-1',
    name: 'CNTS de Dakar',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Route de Rufisque',
    latitude: 14.7,
    longitude: -17.4,
    structureType: StructureType.CNTS,
    affiliatedCntsId: null,
  },
});

const ADMIN_USER = makeUser({
  id: 'admin-1',
  role: Role.ADMIN,
  healthStructureId: null,
  employerStructure: null,
});

const UNVERIFIED_USER = makeUser({
  employerStructure: {
    id: 'structure-1',
    name: 'Hôpital Non Vérifié',
    status: HealthStructureStatus.PENDING_REVIEW,
    isVerified: false,
    address: 'Avenue Nelson Mandela',
    latitude: 14.6937,
    longitude: -17.4441,
    structureType: StructureType.HOSPITAL,
    affiliatedCntsId: 'cnts-1',
  },
});

const BASE_CREATE_DTO: CreateAlertDto = {
  bloodType: BloodType.O_NEG,
  quantityNeeded: 2,
  urgencyLevel: UrgencyLevel.VITAL,
  serviceUnit: undefined,
  radiusKm: 10,
  latitude: 14.6937,
  longitude: -17.4441,
};

describe('AlertsService', () => {
  let service: AlertsService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;
  let push: ReturnType<typeof createMockPushService>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();
    push = createMockPushService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: AlertsRepository, useValue: repository },
        { provide: EventsService, useValue: events },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get(AlertsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    beforeEach(() => {
      repository.createAlert.mockResolvedValue(ALERT_DETAIL);
      repository.findNearbyDonors.mockResolvedValue([]);
    });

    it("crée l'alerte et retourne le résultat avec notifiedDonors", async () => {
      const result = await service.createAlert(BASE_CREATE_DTO, HOSPITAL_AGENT);

      expect(repository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          bloodType: BloodType.O_NEG,
          quantityNeeded: 2,
          healthStructureId: 'structure-1',
          createdByUserId: 'agent-1',
        }),
      );
      expect(result.alert).toEqual(ALERT_DETAIL);
      expect(result.notifiedDonors).toBe(0);
    });

    it('émet des événements Socket.io aux donneurs proches', async () => {
      repository.findNearbyDonors.mockResolvedValue([
        { id: 'donor-1', expoPushToken: null, distance_km: 1.2 },
        {
          id: 'donor-2',
          expoPushToken: 'ExponentPushToken[xxx]',
          distance_km: 2.4,
        },
      ]);

      await service.createAlert(BASE_CREATE_DTO, HOSPITAL_AGENT);

      expect(events.emitToUser).toHaveBeenCalledTimes(2);
      expect(events.emitToUser).toHaveBeenCalledWith(
        'donor-1',
        'alert:new',
        expect.objectContaining({ alertId: 'alert-1' }),
      );
    });

    it('envoie une push multicast aux donneurs avec token', async () => {
      repository.findNearbyDonors.mockResolvedValue([
        {
          id: 'donor-1',
          expoPushToken: 'ExponentPushToken[aaa]',
          distance_km: 1,
        },
        {
          id: 'donor-2',
          expoPushToken: 'ExponentPushToken[bbb]',
          distance_km: 2,
        },
      ]);

      await service.createAlert(BASE_CREATE_DTO, HOSPITAL_AGENT);

      expect(push.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ['ExponentPushToken[aaa]', 'ExponentPushToken[bbb]'],
        }),
      );
    });

    it('escalade vers la CNTS pour un hôpital avec affiliatedCntsId', async () => {
      await service.createAlert(BASE_CREATE_DTO, HOSPITAL_AGENT);

      expect(events.emitToStructure).toHaveBeenCalledWith(
        'cnts-1',
        'alert:escalation',
        expect.objectContaining({ alertId: 'alert-1' }),
      );
    });

    it("n'escalade pas pour une CNTS", async () => {
      await service.createAlert(
        { ...BASE_CREATE_DTO, origin: AlertOrigin.CNTS_DIRECT },
        CNTS_AGENT,
      );

      expect(events.emitToStructure).not.toHaveBeenCalledWith(
        expect.any(String),
        'alert:escalation',
        expect.any(Object),
      );
    });

    it("lève ForbiddenException si la structure n'est pas vérifiée", async () => {
      await expect(
        service.createAlert(BASE_CREATE_DTO, UNVERIFIED_USER),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.createAlert).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si les coordonnées sont manquantes', async () => {
      const dtoSansCoords: CreateAlertDto = {
        bloodType: BloodType.O_NEG,
        quantityNeeded: 2,
        urgencyLevel: UrgencyLevel.VITAL,
      };
      const userSansCoords = makeUser({
        employerStructure: {
          ...HOSPITAL_AGENT.employerStructure!,
          latitude: null,
          longitude: null,
        },
      });

      await expect(
        service.createAlert(dtoSansCoords, userSansCoords),
      ).rejects.toThrow(BadRequestException);
    });

    it('calcule expiresAt automatiquement selon urgencyLevel VITAL (60min)', async () => {
      const before = Date.now();

      await service.createAlert(BASE_CREATE_DTO, HOSPITAL_AGENT);

      const callArgs = repository.createAlert.mock.calls[0][0];
      const expiresAt = callArgs.expiresAt as Date;
      const diffMinutes = (expiresAt.getTime() - before) / 1000 / 60;

      expect(diffMinutes).toBeCloseTo(60, 0);
    });

    it('utilise expiresAt fourni dans le dto', async () => {
      const dto = {
        ...BASE_CREATE_DTO,
        expiresAt: '2026-12-31T23:59:59Z',
      };

      await service.createAlert(dto, HOSPITAL_AGENT);

      expect(repository.createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date('2026-12-31T23:59:59Z'),
        }),
      );
    });
  });

  describe('getNearbyAlerts', () => {
    it('retourne les alertes proches avec distance arrondie', async () => {
      repository.findNearbyActive.mockResolvedValue([
        {
          id: 'alert-1',
          bloodType: BloodType.O_NEG,
          quantityNeeded: 2,
          quantityConfirmed: 0,
          urgencyLevel: 'VITAL',
          status: 'ACTIVE',
          serviceUnit: 'EMERGENCY_ROOM',
          address: 'Avenue Nelson Mandela',
          latitude: 14.6937,
          longitude: -17.4441,
          radiusKm: 10,
          expiresAt: null,
          createdAt: new Date(),
          structureId: 'structure-1',
          structureName: 'Hôpital Principal',
          structureAddress: 'Avenue Nelson Mandela',
          structureLatitude: 14.6937,
          structureLongitude: -17.4441,
          distance_km: 1.456,
        },
      ]);

      const result = await service.getNearbyAlerts(
        { lat: 14.6937, lng: -17.4441, radius: 15 },
        HOSPITAL_AGENT,
      );

      expect(result[0].distance_km).toBe(1.5);
      expect(result[0].healthStructure.id).toBe('structure-1');
    });

    it('utilise les coordonnées du profil si non fournies dans le dto', async () => {
      repository.findNearbyActive.mockResolvedValue([]);

      await service.getNearbyAlerts({}, HOSPITAL_AGENT);

      expect(repository.findNearbyActive).toHaveBeenCalledWith(
        14.6937,
        -17.4441,
        15,
        'agent-1',
      );
    });

    it('lève BadRequestException si aucune coordonnée disponible', async () => {
      const userSansCoords = makeUser({ latitude: null, longitude: null });

      await expect(service.getNearbyAlerts({}, userSansCoords)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAlertById', () => {
    it("retourne l'alerte trouvée", async () => {
      repository.findByIdWithDetails.mockResolvedValue(ALERT_DETAIL);

      const result = await service.getAlertById('alert-1');

      expect(result).toEqual(ALERT_DETAIL);
    });

    it("lève NotFoundException si l'alerte est introuvable", async () => {
      repository.findByIdWithDetails.mockResolvedValue(null);

      await expect(service.getAlertById('inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyStructureAlerts', () => {
    it('retourne les alertes paginées de la structure', async () => {
      repository.findByStructure.mockResolvedValue({
        data: [ALERT_DETAIL],
        total: 1,
      });

      const result = await service.getMyStructureAlerts(HOSPITAL_AGENT, {});

      expect(repository.findByStructure).toHaveBeenCalledWith('structure-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(result.alerts).toEqual([ALERT_DETAIL]);
      expect(result.pagination.total).toBe(1);
    });

    it("lève ForbiddenException si l'utilisateur n'a pas de structure", async () => {
      await expect(
        service.getMyStructureAlerts(ADMIN_USER, {}),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAlertResponses', () => {
    beforeEach(() => {
      repository.findByIdWithDetails.mockResolvedValue(ALERT_DETAIL);
      repository.findResponses.mockResolvedValue([
        {
          id: 'r-1',
          status: 'CONFIRMED',
          etaMinutes: 15,
          respondedAt: new Date(),
          arrivedAt: null,
          donor: {},
        },
        {
          id: 'r-2',
          status: 'ARRIVED',
          etaMinutes: 10,
          respondedAt: new Date(),
          arrivedAt: new Date(),
          donor: {},
        },
        {
          id: 'r-3',
          status: 'DECLINED',
          etaMinutes: null,
          respondedAt: new Date(),
          arrivedAt: null,
          donor: {},
        },
      ]);
    });

    it('retourne les réponses avec le résumé correct', async () => {
      const result = await service.getAlertResponses('alert-1', HOSPITAL_AGENT);

      expect(result.summary).toEqual({
        confirmed: 1,
        arrived: 1,
        declined: 1,
        noShow: 0,
      });
      expect(result.responses).toHaveLength(3);
    });

    it("lève NotFoundException si l'alerte est introuvable", async () => {
      repository.findByIdWithDetails.mockResolvedValue(null);

      await expect(
        service.getAlertResponses('inexistant', HOSPITAL_AGENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException pour une autre structure', async () => {
      const otherAgent = makeUser({ healthStructureId: 'autre-structure' });

      await expect(
        service.getAlertResponses('alert-1', otherAgent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('autorise un admin quelle que soit la structure', async () => {
      const result = await service.getAlertResponses('alert-1', ADMIN_USER);

      expect(result.alert).toEqual(ALERT_DETAIL);
    });
  });

  describe('closeAlert', () => {
    beforeEach(() => {
      repository.findByIdWithDetails.mockResolvedValue(ALERT_DETAIL);
      repository.closeAlert.mockResolvedValue({
        ...ALERT_DETAIL,
        status: 'CANCELLED',
        closedAt: new Date(),
      });
    });

    it("ferme l'alerte et émet les événements", async () => {
      const result = await service.closeAlert('alert-1', HOSPITAL_AGENT);

      expect(repository.closeAlert).toHaveBeenCalledWith('alert-1');
      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'alert:closed',
        expect.objectContaining({ status: 'CANCELLED' }),
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        'structure-1',
        'alert:closed',
        expect.objectContaining({ alertId: 'alert-1' }),
      );
      expect(result.status).toBe('CANCELLED');
    });

    it("lève NotFoundException si l'alerte est introuvable", async () => {
      repository.findByIdWithDetails.mockResolvedValue(null);

      await expect(
        service.closeAlert('inexistant', HOSPITAL_AGENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException pour une autre structure', async () => {
      const otherAgent = makeUser({ healthStructureId: 'autre-structure' });

      await expect(service.closeAlert('alert-1', otherAgent)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lève BadRequestException si l'alerte n'est pas ACTIVE", async () => {
      repository.findByIdWithDetails.mockResolvedValue({
        ...ALERT_DETAIL,
        status: AlertStatus.CANCELLED,
      });

      await expect(
        service.closeAlert('alert-1', HOSPITAL_AGENT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('incrementConfirmedCount', () => {
    it('délègue au repository incrementConfirmed', async () => {
      repository.incrementConfirmed.mockResolvedValue({
        ...ALERT_DETAIL,
        quantityConfirmed: 1,
      });

      const result = await service.incrementConfirmedCount('alert-1');

      expect(repository.incrementConfirmed).toHaveBeenCalledWith('alert-1');
      expect(result.quantityConfirmed).toBe(1);
    });
  });

  describe('decrementConfirmedCount', () => {
    it('délègue au repository decrementConfirmed', async () => {
      repository.decrementConfirmed.mockResolvedValue({
        ...ALERT_DETAIL,
        quantityConfirmed: 0,
      });

      const result = await service.decrementConfirmedCount('alert-1');

      expect(repository.decrementConfirmed).toHaveBeenCalledWith('alert-1');
      expect(result.quantityConfirmed).toBe(0);
    });
  });
});

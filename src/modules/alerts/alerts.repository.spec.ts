import { Test, TestingModule } from '@nestjs/testing';
import { AlertsRepository } from './alerts.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertOrigin, BloodType } from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';

const createMockPrismaService = () => ({
  alert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  alertResponse: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
});

const ALERT_DETAIL = {
  id: 'alert-1',
  bloodType: BloodType.O_NEG,
  quantityNeeded: 2,
  quantityConfirmed: 0,
  urgencyLevel: 'VITAL',
  status: 'ACTIVE',
  origin: 'HOSPITAL_DIRECT',
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

describe('AlertsRepository', () => {
  let repository: AlertsRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(AlertsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    it("crée l'alerte avec les données fournies", async () => {
      prisma.alert.create.mockResolvedValue(ALERT_DETAIL);

      const data: Prisma.AlertUncheckedCreateInput = {
        bloodType: BloodType.O_NEG,
        quantityNeeded: 2,
        urgencyLevel: 'VITAL',
        serviceUnit: 'EMERGENCY_ROOM',
        radiusKm: 10,
        address: 'Avenue Nelson Mandela',
        latitude: 14.6937,
        longitude: -17.4441,
        expiresAt: new Date('2026-06-25T11:00:00'),
        healthStructureId: 'structure-1',
        createdByUserId: 'agent-1',
        origin: AlertOrigin.HOSPITAL_DIRECT,
        bloodRequestId: null,
      };

      const result = await repository.createAlert(data);

      expect(prisma.alert.create).toHaveBeenCalledWith({
        data,
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result).toEqual(ALERT_DETAIL);
    });
  });

  describe('findByIdWithDetails', () => {
    it("retourne l'alerte avec le select detail complet", async () => {
      prisma.alert.findUnique.mockResolvedValue(ALERT_DETAIL);

      const result = await repository.findByIdWithDetails('alert-1');

      expect(prisma.alert.findUnique).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        select: expect.objectContaining({
          id: true,
          createdBy: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
      expect(result).toEqual(ALERT_DETAIL);
    });

    it("retourne null si l'alerte est introuvable", async () => {
      prisma.alert.findUnique.mockResolvedValue(null);

      const result = await repository.findByIdWithDetails('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findNearbyActive', () => {
    it('exécute la requête SQL géospatiale', async () => {
      const rows = [{ id: 'alert-1', distance_km: 1.4 }];
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await repository.findNearbyActive(
        14.6937,
        -17.4441,
        15,
        'user-1',
      );

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(rows);
    });
  });

  describe('findNearbyDonors', () => {
    it('exécute la requête SQL pour trouver les donneurs proches', async () => {
      const donors = [{ id: 'donor-1', firstName: 'Awa', distance_km: 0.8 }];
      prisma.$queryRaw.mockResolvedValue(donors);

      const result = await repository.findNearbyDonors(
        14.6937,
        -17.4441,
        10,
        BloodType.O_NEG,
      );

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(donors);
    });
  });

  describe('findResponses', () => {
    it('retourne les réponses triées par statut et date', async () => {
      const responses = [
        {
          id: 'response-1',
          status: 'CONFIRMED',
          etaMinutes: 15,
          respondedAt: new Date(),
          arrivedAt: null,
          donor: {
            id: 'donor-1',
            firstName: 'Awa',
            lastName: 'Diop',
            bloodType: BloodType.O_NEG,
            avatarUrl: null,
            phone: '+221770000000',
          },
        },
      ];
      prisma.alertResponse.findMany.mockResolvedValue(responses);

      const result = await repository.findResponses('alert-1');

      expect(prisma.alertResponse.findMany).toHaveBeenCalledWith({
        where: { alertId: 'alert-1' },
        select: expect.objectContaining({ id: true, status: true }),
        orderBy: [{ status: 'asc' }, { respondedAt: 'asc' }],
      });
      expect(result).toEqual(responses);
    });
  });

  describe('incrementConfirmed', () => {
    it('incrémente quantityConfirmed et reste ACTIVE si quota non atteint', async () => {
      const updated = {
        ...ALERT_DETAIL,
        quantityConfirmed: 1,
        status: 'ACTIVE',
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          alert: { update: jest.fn().mockResolvedValue(updated) },
        };
        return cb(tx);
      });

      const result = await repository.incrementConfirmed('alert-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.quantityConfirmed).toBe(1);
    });

    it('passe à QUOTA_REACHED si quantityConfirmed >= quantityNeeded', async () => {
      const afterIncrement = {
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 2,
        status: 'ACTIVE',
        healthStructureId: 'structure-1',
      };
      const afterQuota = { ...afterIncrement, status: 'QUOTA_REACHED' };
      const alertUpdate = jest
        .fn()
        .mockResolvedValueOnce(afterIncrement)
        .mockResolvedValueOnce(afterQuota);

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = { alert: { update: alertUpdate } };
        return cb(tx);
      });

      const result = await repository.incrementConfirmed('alert-1');

      expect(result.status).toBe('QUOTA_REACHED');
      expect(alertUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('decrementConfirmed', () => {
    it('décrémente quantityConfirmed et reste QUOTA_REACHED si quota encore atteint', async () => {
      const updated = {
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 2,
        status: 'QUOTA_REACHED',
        healthStructureId: 'structure-1',
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = { alert: { update: jest.fn().mockResolvedValue(updated) } };
        return cb(tx);
      });

      const result = await repository.decrementConfirmed('alert-1');

      expect(result.status).toBe('QUOTA_REACHED');
    });

    it('repasse à ACTIVE si quantityConfirmed < quantityNeeded', async () => {
      const afterDecrement = {
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 1,
        status: 'QUOTA_REACHED',
        healthStructureId: 'structure-1',
      };
      const afterActive = { ...afterDecrement, status: 'ACTIVE' };
      const alertUpdate = jest
        .fn()
        .mockResolvedValueOnce(afterDecrement)
        .mockResolvedValueOnce(afterActive);

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = { alert: { update: alertUpdate } };
        return cb(tx);
      });

      const result = await repository.decrementConfirmed('alert-1');

      expect(result.status).toBe('ACTIVE');
      expect(alertUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('closeAlert', () => {
    it('met le statut à CANCELLED avec closedAt', async () => {
      const closed = {
        ...ALERT_DETAIL,
        status: 'CANCELLED',
        closedAt: new Date(),
      };
      prisma.alert.update.mockResolvedValue(closed);

      const result = await repository.closeAlert('alert-1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { status: 'CANCELLED', closedAt: expect.any(Date) },
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('expireStaleAlerts', () => {
    it('met à jour les alertes ACTIVE expirées en EXPIRED', async () => {
      prisma.alert.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.expireStaleAlerts();

      expect(prisma.alert.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          expiresAt: { lte: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
      expect(result).toEqual({ count: 3 });
    });
  });
});

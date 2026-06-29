import { Test, TestingModule } from '@nestjs/testing';
import { AlertResponsesRepository } from './alert-responses.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertResponseStatus, AlertStatus } from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  alertResponse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  alert: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  jambaarsProfile: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

const ALERT_RESPONSE = {
  id: 'response-1',
  alertId: 'alert-1',
  donorId: 'donor-1',
  status: AlertResponseStatus.CONFIRMED,
  etaMinutes: 15,
  qrCode: 'VITA-X9K2-M4P7',
  respondedAt: new Date('2026-06-25'),
  arrivedAt: null,
  createdAt: new Date('2026-06-25'),
  updatedAt: new Date('2026-06-25'),
};

const ALERT = {
  id: 'alert-1',
  quantityNeeded: 2,
  quantityConfirmed: 1,
  status: AlertStatus.ACTIVE,
};

describe('AlertResponsesRepository', () => {
  let repository: AlertResponsesRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertResponsesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(AlertResponsesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByAlertAndDonor', () => {
    it('retourne la réponse pour une alerte et un donneur', async () => {
      prisma.alertResponse.findUnique.mockResolvedValue(ALERT_RESPONSE);

      const result = await repository.findByAlertAndDonor('alert-1', 'donor-1');

      expect(prisma.alertResponse.findUnique).toHaveBeenCalledWith({
        where: { alertId_donorId: { alertId: 'alert-1', donorId: 'donor-1' } },
      });
      expect(result).toEqual(ALERT_RESPONSE);
    });

    it('retourne null si aucune réponse trouvée', async () => {
      prisma.alertResponse.findUnique.mockResolvedValue(null);

      const result = await repository.findByAlertAndDonor(
        'alert-1',
        'inexistant',
      );

      expect(result).toBeNull();
    });
  });

  describe('findActiveAlert', () => {
    it("retourne l'alerte active non expirée", async () => {
      prisma.alert.findFirst.mockResolvedValue(ALERT);

      const result = await repository.findActiveAlert('alert-1');

      expect(prisma.alert.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'alert-1',
          status: AlertStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        },
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result).toEqual(ALERT);
    });

    it("retourne null si l'alerte est expirée ou introuvable", async () => {
      prisma.alert.findFirst.mockResolvedValue(null);

      const result = await repository.findActiveAlert('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findActiveConfirmationsForDonor', () => {
    it('retourne les confirmations actives du donneur', async () => {
      prisma.alertResponse.findMany.mockResolvedValue([ALERT_RESPONSE]);

      const result =
        await repository.findActiveConfirmationsForDonor('donor-1');

      expect(prisma.alertResponse.findMany).toHaveBeenCalledWith({
        where: { donorId: 'donor-1', status: AlertResponseStatus.CONFIRMED },
      });
      expect(result).toEqual([ALERT_RESPONSE]);
    });

    it('retourne un tableau vide si aucune confirmation active', async () => {
      prisma.alertResponse.findMany.mockResolvedValue([]);

      const result =
        await repository.findActiveConfirmationsForDonor('donor-sans-confirm');

      expect(result).toEqual([]);
    });
  });

  describe('findDonorProfile', () => {
    it('retourne le profil Jambaar du donneur', async () => {
      const profile = {
        id: 'profile-1',
        userId: 'donor-1',
        totalPoints: 500,
        nextEligibilityAt: null,
      };
      prisma.jambaarsProfile.findUnique.mockResolvedValue(profile);

      const result = await repository.findDonorProfile('donor-1');

      expect(prisma.jambaarsProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'donor-1' },
      });
      expect(result).toEqual(profile);
    });
  });

  describe('createResponse', () => {
    it('crée la réponse avec les données fournies', async () => {
      prisma.alertResponse.create.mockResolvedValue(ALERT_RESPONSE);

      const data = {
        alertId: 'alert-1',
        donorId: 'donor-1',
        status: AlertResponseStatus.CONFIRMED,
        etaMinutes: 15,
        qrCode: 'VITA-X9K2-M4P7',
      };

      const result = await repository.createResponse(data);

      expect(prisma.alertResponse.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(ALERT_RESPONSE);
    });
  });

  describe('updateResponseStatus', () => {
    it('met à jour le statut de la réponse', async () => {
      const updated = {
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.ARRIVED,
      };
      prisma.alertResponse.update.mockResolvedValue(updated);

      const result = await repository.updateResponseStatus('response-1', {
        status: AlertResponseStatus.ARRIVED,
        arrivedAt: new Date(),
      });

      expect(prisma.alertResponse.update).toHaveBeenCalledWith({
        where: { id: 'response-1' },
        data: expect.objectContaining({ status: AlertResponseStatus.ARRIVED }),
      });
      expect(result).toEqual(updated);
    });
  });

  describe('upsertDecline', () => {
    it('crée ou met à jour la réponse en DECLINED', async () => {
      const declined = {
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.DECLINED,
      };
      prisma.alertResponse.upsert.mockResolvedValue(declined);

      const result = await repository.upsertDecline('alert-1', 'donor-1');

      expect(prisma.alertResponse.upsert).toHaveBeenCalledWith({
        where: { alertId_donorId: { alertId: 'alert-1', donorId: 'donor-1' } },
        create: {
          alertId: 'alert-1',
          donorId: 'donor-1',
          status: AlertResponseStatus.DECLINED,
        },
        update: { status: AlertResponseStatus.DECLINED },
      });
      expect(result.status).toBe(AlertResponseStatus.DECLINED);
    });
  });

  describe('incrementAlertConfirmed', () => {
    it("incrémente quantityConfirmed et retourne l'alerte mise à jour", async () => {
      const updated = { ...ALERT, quantityConfirmed: 2 };
      prisma.alert.update.mockResolvedValue(updated);

      const result = await repository.incrementAlertConfirmed('alert-1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { quantityConfirmed: { increment: 1 } },
        select: expect.objectContaining({ id: true, quantityConfirmed: true }),
      });
      expect(result.quantityConfirmed).toBe(2);
    });
  });

  describe('decrementAlertConfirmed', () => {
    it("décrémente quantityConfirmed et retourne l'alerte mise à jour", async () => {
      const updated = { ...ALERT, quantityConfirmed: 0 };
      prisma.alert.update.mockResolvedValue(updated);

      const result = await repository.decrementAlertConfirmed('alert-1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { quantityConfirmed: { decrement: 1 } },
        select: expect.objectContaining({ id: true, quantityConfirmed: true }),
      });
      expect(result.quantityConfirmed).toBe(0);
    });
  });

  describe('closeAlert', () => {
    it("passe l'alerte en QUOTA_REACHED avec closedAt", async () => {
      prisma.alert.update.mockResolvedValue({
        ...ALERT,
        status: AlertStatus.QUOTA_REACHED,
        closedAt: new Date(),
      });

      await repository.closeAlert('alert-1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { status: AlertStatus.QUOTA_REACHED, closedAt: expect.any(Date) },
      });
    });
  });

  describe('reopenAlertIfNecessary', () => {
    it("réouvre l'alerte si QUOTA_REACHED et quota non atteint", async () => {
      prisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 1,
        status: AlertStatus.QUOTA_REACHED,
      });
      prisma.alert.update.mockResolvedValue({});

      const result = await repository.reopenAlertIfNecessary('alert-1');

      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { status: AlertStatus.ACTIVE, closedAt: null },
      });
      expect(result).toBe(true);
    });

    it("ne réouvre pas l'alerte si quota encore atteint", async () => {
      prisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 2,
        status: AlertStatus.QUOTA_REACHED,
      });

      const result = await repository.reopenAlertIfNecessary('alert-1');

      expect(prisma.alert.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("ne réouvre pas si l'alerte est ACTIVE", async () => {
      prisma.alert.findUnique.mockResolvedValue({
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 1,
        status: AlertStatus.ACTIVE,
      });

      const result = await repository.reopenAlertIfNecessary('alert-1');

      expect(prisma.alert.update).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('incrementNoShowCount', () => {
    it('incrémente noShowCount du profil donneur', async () => {
      prisma.jambaarsProfile.update.mockResolvedValue({});

      await repository.incrementNoShowCount('donor-1');

      expect(prisma.jambaarsProfile.update).toHaveBeenCalledWith({
        where: { userId: 'donor-1' },
        data: { noShowCount: { increment: 1 } },
      });
    });
  });
});

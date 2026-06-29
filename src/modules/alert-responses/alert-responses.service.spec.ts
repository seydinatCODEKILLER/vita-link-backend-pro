import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertResponsesService } from './alert-responses.service';
import { AlertResponsesRepository } from './alert-responses.repository';
import { AlertsService } from '../alerts/alerts.service';
import { EventsService } from '@/events/events.service';
import { AlertResponseStatus, AlertStatus } from '@/generated/prisma/enums';

const createMockRepository = () => ({
  findByAlertAndDonor: jest.fn(),
  findActiveAlert: jest.fn(),
  findActiveConfirmationsForDonor: jest.fn(),
  findDonorProfile: jest.fn(),
  createResponse: jest.fn(),
  updateResponseStatus: jest.fn(),
  upsertDecline: jest.fn(),
  incrementAlertConfirmed: jest.fn(),
  decrementAlertConfirmed: jest.fn(),
  closeAlert: jest.fn(),
  reopenAlertIfNecessary: jest.fn(),
  incrementNoShowCount: jest.fn(),
});

const createMockAlertsService = () => ({
  decrementConfirmedCount: jest.fn(),
});

const createMockEventsService = () => ({
  emitToAlert: jest.fn(),
  emitToStructure: jest.fn(),
});

const ALERT = {
  id: 'alert-1',
  quantityNeeded: 2,
  quantityConfirmed: 1,
  status: AlertStatus.ACTIVE,
};

const ALERT_RESPONSE = {
  id: 'response-1',
  alertId: 'alert-1',
  donorId: 'donor-1',
  status: AlertResponseStatus.CONFIRMED,
  etaMinutes: 15,
  qrCode: 'VITA-X9K2-M4P7',
  respondedAt: new Date('2026-06-25'),
  arrivedAt: null,
};

describe('AlertResponsesService', () => {
  let service: AlertResponsesService;
  let repository: ReturnType<typeof createMockRepository>;
  let alertsService: ReturnType<typeof createMockAlertsService>;
  let events: ReturnType<typeof createMockEventsService>;

  beforeEach(async () => {
    repository = createMockRepository();
    alertsService = createMockAlertsService();
    events = createMockEventsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertResponsesService,
        { provide: AlertResponsesRepository, useValue: repository },
        { provide: AlertsService, useValue: alertsService },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(AlertResponsesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('confirm', () => {
    beforeEach(() => {
      repository.findActiveAlert.mockResolvedValue(ALERT);
      repository.findActiveConfirmationsForDonor.mockResolvedValue([]);
      repository.findDonorProfile.mockResolvedValue(null);
      repository.findByAlertAndDonor.mockResolvedValue(null);
      repository.createResponse.mockResolvedValue(ALERT_RESPONSE);
      repository.incrementAlertConfirmed.mockResolvedValue({
        ...ALERT,
        quantityConfirmed: 1,
      });
      repository.closeAlert.mockResolvedValue({});
    });

    it('confirme la venue et retourne le QR Code', async () => {
      const result = await service.confirm('alert-1', 'donor-1', {});

      expect(repository.createResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          alertId: 'alert-1',
          donorId: 'donor-1',
          status: AlertResponseStatus.CONFIRMED,
          qrCode: expect.stringMatching(/^VITA-/),
        }),
      );
      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'response:new',
        expect.objectContaining({ status: AlertResponseStatus.CONFIRMED }),
      );
      expect(result.qrCode).toBeDefined();
      expect(result.isQuotaReached).toBe(false);
    });

    it("ferme l'alerte si quota atteint après confirmation", async () => {
      repository.incrementAlertConfirmed.mockResolvedValue({
        ...ALERT,
        quantityConfirmed: 2,
        quantityNeeded: 2,
      });

      const result = await service.confirm('alert-1', 'donor-1', {});

      expect(repository.closeAlert).toHaveBeenCalledWith('alert-1');
      expect(result.isQuotaReached).toBe(true);
    });

    it("lève NotFoundException si l'alerte est introuvable ou expirée", async () => {
      repository.findActiveAlert.mockResolvedValue(null);

      await expect(
        service.confirm('inexistant', 'donor-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève BadRequestException si le donneur a déjà une confirmation active', async () => {
      repository.findActiveConfirmationsForDonor.mockResolvedValue([
        ALERT_RESPONSE,
      ]);

      await expect(service.confirm('alert-1', 'donor-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it("lève BadRequestException si le donneur n'est pas éligible", async () => {
      repository.findDonorProfile.mockResolvedValue({
        nextEligibilityAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await expect(service.confirm('alert-1', 'donor-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le donneur a déjà répondu à cette alerte', async () => {
      repository.findByAlertAndDonor.mockResolvedValue(ALERT_RESPONSE);

      await expect(service.confirm('alert-1', 'donor-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('decline', () => {
    beforeEach(() => {
      repository.findActiveAlert.mockResolvedValue(ALERT);
      repository.findByAlertAndDonor.mockResolvedValue(null);
      repository.upsertDecline.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.DECLINED,
      });
    });

    it('enregistre le refus et émet response:declined', async () => {
      const result = await service.decline('alert-1', 'donor-1');

      expect(repository.upsertDecline).toHaveBeenCalledWith(
        'alert-1',
        'donor-1',
      );
      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'response:declined',
        expect.objectContaining({ status: AlertResponseStatus.DECLINED }),
      );
      expect(result.message).toBeDefined();
    });

    it('retourne un message si déjà décliné', async () => {
      repository.findByAlertAndDonor.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.DECLINED,
      });

      const result = await service.decline('alert-1', 'donor-1');

      expect(repository.upsertDecline).not.toHaveBeenCalled();
      expect(result.message).toBeDefined();
    });

    it('lève BadRequestException si le donneur a déjà confirmé', async () => {
      repository.findByAlertAndDonor.mockResolvedValue(ALERT_RESPONSE);

      await expect(service.decline('alert-1', 'donor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it("lève NotFoundException si l'alerte est introuvable", async () => {
      repository.findActiveAlert.mockResolvedValue(null);

      await expect(service.decline('inexistant', 'donor-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markArrived', () => {
    beforeEach(() => {
      repository.findByAlertAndDonor.mockResolvedValue(ALERT_RESPONSE);
      repository.updateResponseStatus.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.ARRIVED,
        arrivedAt: new Date(),
      });
    });

    it("marque l'arrivée du donneur et émet response:arrived", async () => {
      const result = await service.markArrived('alert-1', 'donor-1');

      expect(repository.updateResponseStatus).toHaveBeenCalledWith(
        'response-1',
        expect.objectContaining({
          status: AlertResponseStatus.ARRIVED,
          arrivedAt: expect.any(Date),
        }),
      );
      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'response:arrived',
        expect.objectContaining({ donorId: 'donor-1' }),
      );
      expect(result.message).toBeDefined();
    });

    it('lève NotFoundException si aucune réponse trouvée', async () => {
      repository.findByAlertAndDonor.mockResolvedValue(null);

      await expect(service.markArrived('alert-1', 'donor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève BadRequestException si le donneur n'a pas confirmé", async () => {
      repository.findByAlertAndDonor.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.DECLINED,
      });

      await expect(service.markArrived('alert-1', 'donor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markNoShow', () => {
    beforeEach(() => {
      repository.findByAlertAndDonor.mockResolvedValue(ALERT_RESPONSE);
      repository.updateResponseStatus.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.NO_SHOW,
      });
      alertsService.decrementConfirmedCount.mockResolvedValue({
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 0,
        status: AlertStatus.ACTIVE,
        healthStructureId: 'structure-1',
      });
    });

    it("signale l'absence et émet alert:reactivated si quota non atteint", async () => {
      const result = await service.markNoShow('alert-1', 'donor-1');

      expect(repository.updateResponseStatus).toHaveBeenCalledWith(
        'response-1',
        { status: AlertResponseStatus.NO_SHOW },
      );
      expect(alertsService.decrementConfirmedCount).toHaveBeenCalledWith(
        'alert-1',
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        'structure-1',
        'alert:reactivated',
        expect.objectContaining({ alertId: 'alert-1' }),
      );
      expect(result.message).toBeDefined();
    });

    it("n'émet pas alert:reactivated si alerte déjà QUOTA_REACHED", async () => {
      alertsService.decrementConfirmedCount.mockResolvedValue({
        id: 'alert-1',
        quantityNeeded: 2,
        quantityConfirmed: 2,
        status: AlertStatus.QUOTA_REACHED,
        healthStructureId: 'structure-1',
      });

      await service.markNoShow('alert-1', 'donor-1');

      expect(events.emitToStructure).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si aucune réponse trouvée', async () => {
      repository.findByAlertAndDonor.mockResolvedValue(null);

      await expect(service.markNoShow('alert-1', 'donor-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève BadRequestException si le donneur n'avait pas confirmé", async () => {
      repository.findByAlertAndDonor.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.DECLINED,
      });

      await expect(service.markNoShow('alert-1', 'donor-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelConfirmation', () => {
    beforeEach(() => {
      repository.findByAlertAndDonor.mockResolvedValue(ALERT_RESPONSE);
      repository.updateResponseStatus.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.CANCELLED,
      });
      repository.decrementAlertConfirmed.mockResolvedValue({});
      repository.reopenAlertIfNecessary.mockResolvedValue(false);
    });

    it('annule la confirmation et émet response:cancelled', async () => {
      const result = await service.cancelConfirmation('alert-1', 'donor-1');

      expect(repository.updateResponseStatus).toHaveBeenCalledWith(
        'response-1',
        { status: AlertResponseStatus.CANCELLED },
      );
      expect(repository.decrementAlertConfirmed).toHaveBeenCalledWith(
        'alert-1',
      );
      expect(repository.reopenAlertIfNecessary).toHaveBeenCalledWith('alert-1');
      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'response:cancelled',
        expect.objectContaining({
          donorId: 'donor-1',
          status: AlertResponseStatus.CANCELLED,
          isReopened: false,
        }),
      );
      expect(result.message).toBeDefined();
    });

    it("émet isReopened: true si l'alerte est réouverte", async () => {
      repository.reopenAlertIfNecessary.mockResolvedValue(true);

      await service.cancelConfirmation('alert-1', 'donor-1');

      expect(events.emitToAlert).toHaveBeenCalledWith(
        'alert-1',
        'response:cancelled',
        expect.objectContaining({ isReopened: true }),
      );
    });

    it('lève NotFoundException si aucune réponse trouvée', async () => {
      repository.findByAlertAndDonor.mockResolvedValue(null);

      await expect(
        service.cancelConfirmation('alert-1', 'donor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève BadRequestException si la réponse n'est pas CONFIRMED", async () => {
      repository.findByAlertAndDonor.mockResolvedValue({
        ...ALERT_RESPONSE,
        status: AlertResponseStatus.DECLINED,
      });

      await expect(
        service.cancelConfirmation('alert-1', 'donor-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkActiveConfirmation', () => {
    it('retourne true si le donneur a une confirmation active', async () => {
      repository.findActiveConfirmationsForDonor.mockResolvedValue([
        ALERT_RESPONSE,
      ]);

      const result = await service.checkActiveConfirmation('donor-1');

      expect(result).toEqual({ hasActiveConfirmation: true });
    });

    it('retourne false si aucune confirmation active', async () => {
      repository.findActiveConfirmationsForDonor.mockResolvedValue([]);

      const result = await service.checkActiveConfirmation('donor-1');

      expect(result).toEqual({ hasActiveConfirmation: false });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { EventsService } from '@/events/events.service';
import {
  PurchaseOrderStatus,
  BloodType,
  Role,
  StructureType,
  HealthStructureStatus,
} from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';

const createMockRepository = () => ({
  createOrder: jest.fn(),
  findOrderById: jest.fn(),
  findByCode: jest.fn(),
  findByBloodRequest: jest.fn(),
  findByCnts: jest.fn(),
  findByHospital: jest.fn(),
  markAsUsed: jest.fn(),
  expireStaleOrders: jest.fn(),
  confirmExpiry: jest.fn(),
});

const createMockEventsService = () => ({
  emitToStructure: jest.fn(),
});

const PURCHASE_ORDER = {
  id: 'order-1',
  code: 'CMD-X9K2-M4P7',
  bloodType: BloodType.O_NEG,
  quantity: 3,
  status: PurchaseOrderStatus.PENDING,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  scannedAt: null,
  createdAt: new Date('2026-06-25'),
  updatedAt: new Date('2026-06-25'),
  bloodRequest: {
    id: 'request-1',
    urgencyLevel: 'VITAL',
    serviceUnit: 'EMERGENCY_ROOM',
  },
  cnts: { id: 'cnts-1', name: 'CNTS de Dakar', address: 'Route de Rufisque' },
  hospital: {
    id: 'hospital-1',
    name: 'Hôpital Principal',
    address: 'Avenue Cheikh Anta Diop',
  },
  scannedBy: null,
};

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'user-1',
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa@vita-link.sn',
  role: Role.CNTS_AGENT,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'cnts-1',
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
  employerStructure: {
    id: 'cnts-1',
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

const CNTS_USER = makeUser();

const HOSPITAL_USER = makeUser({
  id: 'hospital-user-1',
  role: Role.HOSPITAL_AGENT,
  healthStructureId: 'hospital-1',
  employerStructure: {
    id: 'hospital-1',
    name: 'Hôpital Principal',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Avenue Cheikh Anta Diop',
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

const OTHER_USER = makeUser({
  id: 'other-1',
  healthStructureId: 'autre-cnts',
  employerStructure: {
    id: 'autre-cnts',
    name: 'CNTS de Thiès',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Thiès',
    latitude: null,
    longitude: null,
    structureType: StructureType.CNTS,
    affiliatedCntsId: null,
  },
});

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PurchaseOrdersRepository, useValue: repository },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(PurchaseOrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createForRequest', () => {
    it('crée le bon de commande et émet purchase_order:created', async () => {
      repository.createOrder.mockResolvedValue(PURCHASE_ORDER);

      const result = await service.createForRequest({
        bloodRequestId: 'request-1',
        cntsId: 'cnts-1',
        hospitalId: 'hospital-1',
        bloodType: BloodType.O_NEG,
        quantity: 3,
      });

      expect(repository.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          bloodRequestId: 'request-1',
          cntsId: 'cnts-1',
          hospitalId: 'hospital-1',
          bloodType: BloodType.O_NEG,
          quantity: 3,
          code: expect.stringMatching(/^CMD-/),
          expiresAt: expect.any(Date),
        }),
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        'hospital-1',
        'purchase_order:created',
        expect.objectContaining({ orderId: PURCHASE_ORDER.id }),
      );
      expect(result).toEqual(PURCHASE_ORDER);
    });
  });

  describe('getByBloodRequest', () => {
    it("retourne le bon pour l'hôpital concerné", async () => {
      repository.findByBloodRequest.mockResolvedValue(PURCHASE_ORDER);

      const result = await service.getByBloodRequest(
        'request-1',
        HOSPITAL_USER,
      );

      expect(result).toEqual(PURCHASE_ORDER);
    });

    it('retourne le bon pour un admin', async () => {
      repository.findByBloodRequest.mockResolvedValue(PURCHASE_ORDER);

      const result = await service.getByBloodRequest('request-1', ADMIN_USER);

      expect(result).toEqual(PURCHASE_ORDER);
    });

    it('lève ForbiddenException si le bon appartient à un autre hôpital', async () => {
      repository.findByBloodRequest.mockResolvedValue(PURCHASE_ORDER);

      await expect(
        service.getByBloodRequest('request-1', OTHER_USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lève NotFoundException si le bon est introuvable', async () => {
      repository.findByBloodRequest.mockResolvedValue(null);

      await expect(
        service.getByBloodRequest('inexistant', HOSPITAL_USER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('scan', () => {
    beforeEach(() => {
      repository.findByCode.mockResolvedValue(PURCHASE_ORDER);
      repository.markAsUsed.mockResolvedValue({
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.USED,
        scannedAt: new Date(),
      });
    });

    it('valide le bon et émet purchase_order:validated', async () => {
      const result = await service.scan('CMD-X9K2-M4P7', CNTS_USER);

      expect(repository.markAsUsed).toHaveBeenCalledWith(
        PURCHASE_ORDER.id,
        CNTS_USER.id,
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        PURCHASE_ORDER.hospital.id,
        'purchase_order:validated',
        expect.objectContaining({ orderId: PURCHASE_ORDER.id }),
      );
      expect(result.message).toBeDefined();
      expect(result.order.status).toBe(PurchaseOrderStatus.USED);
    });

    it('lève NotFoundException si le code est introuvable', async () => {
      repository.findByCode.mockResolvedValue(null);

      await expect(service.scan('CMD-INEXISTANT', CNTS_USER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("lève ForbiddenException si le bon n'appartient pas à la CNTS de l'agent", async () => {
      await expect(service.scan('CMD-X9K2-M4P7', OTHER_USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lève BadRequestException si le bon est déjà utilisé', async () => {
      repository.findByCode.mockResolvedValue({
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.USED,
      });

      await expect(service.scan('CMD-X9K2-M4P7', CNTS_USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le bon est expiré par statut', async () => {
      repository.findByCode.mockResolvedValue({
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.EXPIRED,
      });

      await expect(service.scan('CMD-X9K2-M4P7', CNTS_USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le bon est annulé', async () => {
      repository.findByCode.mockResolvedValue({
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.CANCELLED,
      });

      await expect(service.scan('CMD-X9K2-M4P7', CNTS_USER)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève BadRequestException si le bon est expiré par date', async () => {
      repository.findByCode.mockResolvedValue({
        ...PURCHASE_ORDER,
        expiresAt: new Date('2025-01-01'),
      });

      await expect(service.scan('CMD-X9K2-M4P7', CNTS_USER)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirmExpiry', () => {
    beforeEach(() => {
      repository.findOrderById.mockResolvedValue({
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.EXPIRED,
      });
    });

    it('confirme comme remis (wasDelivered: true) et émet purchase_order:validated', async () => {
      const confirmed = { ...PURCHASE_ORDER, status: PurchaseOrderStatus.USED };
      repository.confirmExpiry.mockResolvedValue(confirmed);

      const result = await service.confirmExpiry(
        'order-1',
        { wasDelivered: true },
        CNTS_USER,
      );

      expect(repository.confirmExpiry).toHaveBeenCalledWith(
        'order-1',
        true,
        undefined,
        CNTS_USER.id,
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        confirmed.hospital.id,
        'purchase_order:validated',
        expect.objectContaining({ orderId: confirmed.id }),
      );
      expect(result.message).toContain('USED');
    });

    it('confirme comme non remis (wasDelivered: false) et émet purchase_order:cancelled_stock_restored', async () => {
      const confirmed = {
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.CANCELLED,
      };
      repository.confirmExpiry.mockResolvedValue(confirmed);

      const result = await service.confirmExpiry(
        'order-1',
        { wasDelivered: false },
        CNTS_USER,
      );

      expect(events.emitToStructure).toHaveBeenCalledWith(
        confirmed.hospital.id,
        'purchase_order:cancelled_stock_restored',
        expect.objectContaining({ orderId: confirmed.id }),
      );
      expect(result.message).toContain('recrédité');
    });

    it('lève NotFoundException si le bon est introuvable', async () => {
      repository.findOrderById.mockResolvedValue(null);

      await expect(
        service.confirmExpiry('inexistant', { wasDelivered: true }, CNTS_USER),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si le bon n'appartient pas à la CNTS", async () => {
      await expect(
        service.confirmExpiry('order-1', { wasDelivered: true }, OTHER_USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève BadRequestException si le bon n'est pas au statut EXPIRED", async () => {
      repository.findOrderById.mockResolvedValue(PURCHASE_ORDER);

      await expect(
        service.confirmExpiry('order-1', { wasDelivered: true }, CNTS_USER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getList', () => {
    it('appelle findByCnts pour un utilisateur CNTS', async () => {
      repository.findByCnts.mockResolvedValue({
        data: [PURCHASE_ORDER],
        total: 1,
      });

      const result = await service.getList(CNTS_USER, {});

      expect(repository.findByCnts).toHaveBeenCalledWith('cnts-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(result.orders).toEqual([PURCHASE_ORDER]);
      expect(result.pagination.total).toBe(1);
    });

    it('appelle findByHospital pour un utilisateur hôpital', async () => {
      repository.findByHospital.mockResolvedValue({
        data: [PURCHASE_ORDER],
        total: 1,
      });

      const result = await service.getList(HOSPITAL_USER, {});

      expect(repository.findByHospital).toHaveBeenCalledWith('hospital-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(result.orders).toEqual([PURCHASE_ORDER]);
    });

    it('calcule correctement totalPages', async () => {
      repository.findByCnts.mockResolvedValue({ data: [], total: 45 });

      const result = await service.getList(CNTS_USER, { page: 1, limit: 20 });

      expect(result.pagination.totalPages).toBe(3);
    });

    it('utilise le statut fourni dans le filtre', async () => {
      repository.findByCnts.mockResolvedValue({ data: [], total: 0 });

      await service.getList(CNTS_USER, {
        page: 1,
        limit: 10,
        status: PurchaseOrderStatus.USED,
      });

      expect(repository.findByCnts).toHaveBeenCalledWith('cnts-1', {
        page: 1,
        limit: 10,
        status: PurchaseOrderStatus.USED,
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { PurchaseOrderStatus, BloodType } from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  purchaseOrder: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
});

const PURCHASE_ORDER = {
  id: 'order-1',
  code: 'CMD-X9K2-M4P7',
  bloodType: BloodType.O_NEG,
  quantity: 3,
  status: PurchaseOrderStatus.PENDING,
  expiresAt: new Date('2026-06-26'),
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

describe('PurchaseOrdersRepository', () => {
  let repository: PurchaseOrdersRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(PurchaseOrdersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('crée le bon de commande avec les données fournies', async () => {
      const input = {
        code: 'CMD-X9K2-M4P7',
        bloodRequestId: 'request-1',
        cntsId: 'cnts-1',
        hospitalId: 'hospital-1',
        bloodType: BloodType.O_NEG,
        quantity: 3,
        expiresAt: new Date('2026-06-26'),
      };
      prisma.purchaseOrder.create.mockResolvedValue(PURCHASE_ORDER);

      const result = await repository.createOrder(input);

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith({
        data: input,
        select: expect.objectContaining({ id: true, code: true, status: true }),
      });
      expect(result).toEqual(PURCHASE_ORDER);
    });
  });

  describe('findOrderById', () => {
    it('retourne le bon de commande trouvé', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(PURCHASE_ORDER);

      const result = await repository.findOrderById('order-1');

      expect(prisma.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        select: expect.objectContaining({ id: true, code: true }),
      });
      expect(result).toEqual(PURCHASE_ORDER);
    });

    it('retourne null si le bon est introuvable', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      const result = await repository.findOrderById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findByCode', () => {
    it('retourne le bon de commande par code', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(PURCHASE_ORDER);

      const result = await repository.findByCode('CMD-X9K2-M4P7');

      expect(prisma.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { code: 'CMD-X9K2-M4P7' },
        select: expect.objectContaining({ id: true, code: true }),
      });
      expect(result).toEqual(PURCHASE_ORDER);
    });

    it('retourne null si le code est introuvable', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      const result = await repository.findByCode('CMD-INEXISTANT');

      expect(result).toBeNull();
    });
  });

  describe('findByBloodRequest', () => {
    it('retourne le bon associé à la demande de sang', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(PURCHASE_ORDER);

      const result = await repository.findByBloodRequest('request-1');

      expect(prisma.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { bloodRequestId: 'request-1' },
        select: expect.objectContaining({ id: true }),
      });
      expect(result).toEqual(PURCHASE_ORDER);
    });

    it('retourne null si aucun bon associé', async () => {
      prisma.purchaseOrder.findUnique.mockResolvedValue(null);

      const result = await repository.findByBloodRequest('request-inexistant');

      expect(result).toBeNull();
    });
  });

  describe('markAsUsed', () => {
    it('met le statut à USED avec scannedAt et scannedByUserId', async () => {
      const used = {
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.USED,
        scannedAt: new Date(),
        scannedBy: { id: 'agent-1', firstName: 'Awa', lastName: 'Diop' },
      };
      prisma.purchaseOrder.update.mockResolvedValue(used);

      const result = await repository.markAsUsed('order-1', 'agent-1');

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: PurchaseOrderStatus.USED,
          scannedByUserId: 'agent-1',
          scannedAt: expect.any(Date),
        },
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result).toEqual(used);
    });
  });

  describe('expireStaleOrders', () => {
    it('met à jour les bons PENDING expirés en EXPIRED', async () => {
      prisma.purchaseOrder.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.expireStaleOrders();

      expect(prisma.purchaseOrder.updateMany).toHaveBeenCalledWith({
        where: {
          status: PurchaseOrderStatus.PENDING,
          expiresAt: { lte: expect.any(Date) },
        },
        data: { status: PurchaseOrderStatus.EXPIRED },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('confirmExpiry', () => {
    it('marque le bon comme USED si wasDelivered est true', async () => {
      const confirmed = { ...PURCHASE_ORDER, status: PurchaseOrderStatus.USED };
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          purchaseOrder: { update: jest.fn().mockResolvedValue(confirmed) },
          bloodStock: { update: jest.fn() },
        };
        return cb(tx);
      });

      const result = await repository.confirmExpiry(
        'order-1',
        true,
        'Livraison ok',
        'agent-1',
      );

      expect(result.status).toBe(PurchaseOrderStatus.USED);
    });

    it('marque le bon comme CANCELLED et recrédite le stock si wasDelivered est false', async () => {
      const cancelled = {
        ...PURCHASE_ORDER,
        status: PurchaseOrderStatus.CANCELLED,
      };
      const bloodStockUpdate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          purchaseOrder: { update: jest.fn().mockResolvedValue(cancelled) },
          bloodStock: { update: bloodStockUpdate },
        };
        return cb(tx);
      });

      const result = await repository.confirmExpiry(
        'order-1',
        false,
        undefined,
        'agent-1',
      );

      expect(result.status).toBe(PurchaseOrderStatus.CANCELLED);
      expect(bloodStockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quantity: { increment: PURCHASE_ORDER.quantity } },
        }),
      );
    });

    it('ne recrédite pas le stock si wasDelivered est true', async () => {
      const confirmed = { ...PURCHASE_ORDER, status: PurchaseOrderStatus.USED };
      const bloodStockUpdate = jest.fn();
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          purchaseOrder: { update: jest.fn().mockResolvedValue(confirmed) },
          bloodStock: { update: bloodStockUpdate },
        };
        return cb(tx);
      });

      await repository.confirmExpiry('order-1', true, undefined, 'agent-1');

      expect(bloodStockUpdate).not.toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BloodRequestsRepository } from './blood-requests.repository';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BloodRequestStatus,
  BloodStockLevel,
  BloodType,
} from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';

const createMockPrismaService = () => ({
  bloodRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  healthStructure: {
    findUnique: jest.fn(),
  },
  bloodStock: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

const BLOOD_REQUEST = {
  id: 'request-1',
  bloodType: BloodType.O_NEG,
  quantityNeeded: 3,
  quantityProvided: null,
  urgencyLevel: 'VITAL',
  serviceUnit: 'EMERGENCY_ROOM',
  clinicalContext: null,
  status: BloodRequestStatus.PENDING,
  cntsNotes: null,
  escalatedAlertId: null,
  fulfilledAt: null,
  createdAt: new Date('2026-06-25'),
  updatedAt: new Date('2026-06-25'),
  requestingHospital: {
    id: 'hospital-1',
    name: 'Hôpital Principal',
    address: 'Avenue Nelson Mandela',
    region: 'Dakar',
  },
  requestedBy: { id: 'user-1', firstName: 'Moussa', lastName: 'Fall' },
  handledByCnts: { id: 'cnts-1', name: 'CNTS de Dakar', region: 'Dakar' },
  handledBy: null,
  escalatedAlert: null,
  purchaseOrder: null,
};

describe('BloodRequestsRepository', () => {
  let repository: BloodRequestsRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodRequestsRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(BloodRequestsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('crée la demande avec les données fournies', async () => {
      prisma.bloodRequest.create.mockResolvedValue(BLOOD_REQUEST);

      const data: Prisma.BloodRequestUncheckedCreateInput = {
        requestingHospitalId: 'hospital-1',
        requestedByUserId: 'user-1',
        handledByCntsId: 'cnts-1',
        bloodType: BloodType.O_NEG,
        quantityNeeded: 3,
        urgencyLevel: 'VITAL',
        serviceUnit: 'EMERGENCY_ROOM',
      };

      const result = await repository.createRequest(data);

      expect(prisma.bloodRequest.create).toHaveBeenCalledWith({
        data,
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result).toEqual(BLOOD_REQUEST);
    });
  });

  describe('findRequestById', () => {
    it('retourne la demande avec le select complet', async () => {
      prisma.bloodRequest.findUnique.mockResolvedValue(BLOOD_REQUEST);

      const result = await repository.findRequestById('request-1');

      expect(prisma.bloodRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        select: expect.objectContaining({
          id: true,
          requestingHospital: expect.any(Object),
          handledByCnts: expect.any(Object),
        }),
      });
      expect(result).toEqual(BLOOD_REQUEST);
    });

    it('retourne null si la demande est introuvable', async () => {
      prisma.bloodRequest.findUnique.mockResolvedValue(null);

      const result = await repository.findRequestById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findHospitalStructureById', () => {
    it('retourne la structure hospitalière avec affiliatedCntsId', async () => {
      const hospital = {
        id: 'hospital-1',
        name: 'Hôpital Principal',
        structureType: 'HOSPITAL',
        affiliatedCntsId: 'cnts-1',
        isVerified: true,
        address: 'Avenue Nelson Mandela',
        latitude: 14.6937,
        longitude: -17.4441,
      };
      prisma.healthStructure.findUnique.mockResolvedValue(hospital);

      const result = await repository.findHospitalStructureById('hospital-1');

      expect(prisma.healthStructure.findUnique).toHaveBeenCalledWith({
        where: { id: 'hospital-1' },
        select: expect.objectContaining({
          id: true,
          affiliatedCntsId: true,
          structureType: true,
        }),
      });
      expect(result).toEqual(hospital);
    });
  });

  describe('findStockByCntsAndType', () => {
    it('retourne le stock pour la CNTS et le groupe sanguin', async () => {
      const stock = {
        id: 'stock-1',
        quantity: 10,
        level: BloodStockLevel.ADEQUATE,
      };
      prisma.bloodStock.findUnique.mockResolvedValue(stock);

      const result = await repository.findStockByCntsAndType(
        'cnts-1',
        BloodType.O_NEG,
      );

      expect(prisma.bloodStock.findUnique).toHaveBeenCalledWith({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: 'cnts-1',
            bloodType: BloodType.O_NEG,
          },
        },
      });
      expect(result).toEqual(stock);
    });

    it('retourne null si le stock est introuvable', async () => {
      prisma.bloodStock.findUnique.mockResolvedValue(null);

      const result = await repository.findStockByCntsAndType(
        'cnts-1',
        BloodType.AB_NEG,
      );

      expect(result).toBeNull();
    });
  });

  describe('decrementStock', () => {
    it('décrémente le stock et calcule le bon niveau', async () => {
      const updated = {
        id: 'stock-1',
        quantity: 7,
        level: BloodStockLevel.ADEQUATE,
      };
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          bloodStock: {
            findUnique: jest.fn().mockResolvedValue({ quantity: 10 }),
            update: jest.fn().mockResolvedValue(updated),
          },
        };
        return cb(tx);
      });

      const result = await repository.decrementStock('stock-1', 3);

      expect(result).toEqual(updated);
    });

    it('lève une erreur si le stock est insuffisant', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          bloodStock: {
            findUnique: jest.fn().mockResolvedValue({ quantity: 2 }),
            update: jest.fn(),
          },
        };
        return cb(tx);
      });

      await expect(repository.decrementStock('stock-1', 5)).rejects.toThrow(
        'Stock insuffisant',
      );
    });

    it('lève une erreur si le stock est introuvable', async () => {
      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          bloodStock: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
        };
        return cb(tx);
      });

      await expect(repository.decrementStock('inexistant', 1)).rejects.toThrow(
        'Stock introuvable',
      );
    });

    it('calcule CRITICAL si quantity tombe à 0', async () => {
      const stockUpdate = jest.fn().mockResolvedValue({ quantity: 0 });

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          bloodStock: {
            findUnique: jest.fn().mockResolvedValue({ quantity: 3 }),
            update: stockUpdate,
          },
        };
        return cb(tx);
      });

      await repository.decrementStock('stock-1', 3);

      expect(stockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: BloodStockLevel.CRITICAL }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('met à jour le statut de la demande', async () => {
      const updated = {
        ...BLOOD_REQUEST,
        status: BloodRequestStatus.FULFILLED,
        quantityProvided: 3,
        fulfilledAt: new Date(),
      };
      prisma.bloodRequest.update.mockResolvedValue(updated);

      const result = await repository.updateStatus('request-1', {
        status: BloodRequestStatus.FULFILLED,
        quantityProvided: 3,
        fulfilledAt: new Date(),
      });

      expect(prisma.bloodRequest.update).toHaveBeenCalledWith({
        where: { id: 'request-1' },
        data: expect.objectContaining({ status: BloodRequestStatus.FULFILLED }),
        select: expect.objectContaining({ id: true, status: true }),
      });
      expect(result.status).toBe(BloodRequestStatus.FULFILLED);
    });
  });
});

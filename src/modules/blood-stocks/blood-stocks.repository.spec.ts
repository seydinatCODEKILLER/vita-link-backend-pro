import { Test, TestingModule } from '@nestjs/testing';
import { BloodStocksRepository } from './blood-stocks.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { BloodStockLevel, BloodType } from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  bloodStock: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

const STOCK = {
  id: 'stock-1',
  bloodType: BloodType.O_NEG,
  quantity: 10,
  level: BloodStockLevel.ADEQUATE,
  updatedAt: new Date('2026-06-25'),
};

describe('BloodStocksRepository', () => {
  let repository: BloodStocksRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodStocksRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(BloodStocksRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByStructure', () => {
    it('retourne les stocks triés par bloodType asc', async () => {
      prisma.bloodStock.findMany.mockResolvedValue([STOCK]);

      const result = await repository.findByStructure('structure-1');

      expect(prisma.bloodStock.findMany).toHaveBeenCalledWith({
        where: { healthStructureId: 'structure-1' },
        select: expect.objectContaining({
          id: true,
          bloodType: true,
          quantity: true,
        }),
        orderBy: { bloodType: 'asc' },
      });
      expect(result).toEqual([STOCK]);
    });
  });

  describe('upsertStock', () => {
    it('crée ou met à jour le stock avec le bon niveau', async () => {
      prisma.bloodStock.upsert.mockResolvedValue(STOCK);

      const result = await repository.upsertStock(
        'structure-1',
        BloodType.O_NEG,
        10,
        BloodStockLevel.ADEQUATE,
      );

      expect(prisma.bloodStock.upsert).toHaveBeenCalledWith({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: 'structure-1',
            bloodType: BloodType.O_NEG,
          },
        },
        update: {
          quantity: 10,
          level: BloodStockLevel.ADEQUATE,
          lastSuppliedAt: expect.any(Date),
        },
        create: {
          healthStructureId: 'structure-1',
          bloodType: BloodType.O_NEG,
          quantity: 10,
          level: BloodStockLevel.ADEQUATE,
        },
        select: expect.objectContaining({ id: true, quantity: true }),
      });
      expect(result).toEqual(STOCK);
    });
  });

  describe('findByCntsAndType', () => {
    it('retourne le stock pour une CNTS et un groupe sanguin', async () => {
      prisma.bloodStock.findUnique.mockResolvedValue(STOCK);

      const result = await repository.findByCntsAndType(
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
      expect(result).toEqual(STOCK);
    });

    it('retourne null si le stock est introuvable', async () => {
      prisma.bloodStock.findUnique.mockResolvedValue(null);

      const result = await repository.findByCntsAndType(
        'cnts-1',
        BloodType.AB_NEG,
      );

      expect(result).toBeNull();
    });
  });

  describe('decrement', () => {
    it('décrémente le stock et retourne le résultat mis à jour', async () => {
      const updated = {
        ...STOCK,
        quantity: 6,
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

      const result = await repository.decrement('stock-1', 4);

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

      await expect(repository.decrement('stock-1', 5)).rejects.toThrow(
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

      await expect(repository.decrement('inexistant', 1)).rejects.toThrow(
        'Stock introuvable',
      );
    });

    it('calcule le niveau CRITICAL si quantity tombe à 0', async () => {
      const updated = {
        ...STOCK,
        quantity: 0,
        level: BloodStockLevel.CRITICAL,
      };
      const stockUpdate = jest.fn().mockResolvedValue(updated);

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          bloodStock: {
            findUnique: jest.fn().mockResolvedValue({ quantity: 3 }),
            update: stockUpdate,
          },
        };
        return cb(tx);
      });

      await repository.decrement('stock-1', 3);

      expect(stockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: BloodStockLevel.CRITICAL }),
        }),
      );
    });

    it('calcule le niveau LOW si quantity est entre 1 et 5', async () => {
      const stockUpdate = jest.fn().mockResolvedValue({
        ...STOCK,
        quantity: 3,
        level: BloodStockLevel.LOW,
      });

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          bloodStock: {
            findUnique: jest.fn().mockResolvedValue({ quantity: 10 }),
            update: stockUpdate,
          },
        };
        return cb(tx);
      });

      await repository.decrement('stock-1', 7);

      expect(stockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: BloodStockLevel.LOW }),
        }),
      );
    });
  });
});

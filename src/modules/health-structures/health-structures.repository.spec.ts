import { Test, TestingModule } from '@nestjs/testing';
import { HealthStructuresRepository } from './health-structures.repository';
import { PrismaService } from '@/prisma/prisma.service';
import {
  HealthStructureStatus,
  StructureType,
  Role,
  BloodType,
  BloodStockLevel,
} from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  healthStructure: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  donation: { count: jest.fn() },
  alert: { groupBy: jest.fn() },
  alertResponse: { findFirst: jest.fn() },
  bloodStock: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
});

const STRUCTURE = {
  id: 'structure-1',
  name: 'CNTS de Dakar',
  structureType: StructureType.CNTS,
  registrationNumber: 'REG-001',
  address: 'Route de Rufisque',
  region: 'Dakar',
  latitude: 14.6937,
  longitude: -17.4441,
  phone: '+221338000000',
  email: 'cnts@dakar.sn',
  isVerified: true,
  status: HealthStructureStatus.VERIFIED,
  affiliatedCntsId: null,
  verifiedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
};

const STAFF_MEMBER = {
  id: 'user-1',
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa@cnts.sn',
  phone: '+221771234567',
  role: Role.CNTS_AGENT,
  isStructureAdmin: false,
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

describe('HealthStructuresRepository', () => {
  let repository: HealthStructuresRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthStructuresRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(HealthStructuresRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('retourne toutes les structures avec _count et tri par createdAt desc', async () => {
      prisma.healthStructure.findMany.mockResolvedValue([STRUCTURE]);

      const result = await repository.findAll();

      expect(prisma.healthStructure.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          _count: expect.objectContaining({
            select: expect.objectContaining({ staffMembers: true }),
          }),
        }),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([STRUCTURE]);
    });
  });

  describe('findStructureById', () => {
    it('retourne la structure avec _count', async () => {
      prisma.healthStructure.findUnique.mockResolvedValue(STRUCTURE);

      const result = await repository.findStructureById('structure-1');

      expect(prisma.healthStructure.findUnique).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        select: expect.objectContaining({
          id: true,
          _count: expect.any(Object),
        }),
      });
      expect(result).toEqual(STRUCTURE);
    });

    it('retourne null si la structure est introuvable', async () => {
      prisma.healthStructure.findUnique.mockResolvedValue(null);

      const result = await repository.findStructureById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it("retourne la structure employeur de l'utilisateur", async () => {
      const userWithStructure = {
        healthStructureId: 'structure-1',
        isStructureAdmin: true,
        employerStructure: STRUCTURE,
      };
      prisma.user.findUnique.mockResolvedValue(userWithStructure);

      const result = await repository.findByUserId('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          healthStructureId: true,
          employerStructure: expect.any(Object),
        }),
      });
      expect(result).toEqual(userWithStructure);
    });
  });

  describe('findByRegistrationNumber', () => {
    it('retourne la structure par numéro de registre', async () => {
      prisma.healthStructure.findUnique.mockResolvedValue(STRUCTURE);

      const result = await repository.findByRegistrationNumber('REG-001');

      expect(prisma.healthStructure.findUnique).toHaveBeenCalledWith({
        where: { registrationNumber: 'REG-001' },
      });
      expect(result).toEqual(STRUCTURE);
    });
  });

  describe('findValidCntsById', () => {
    it('retourne la CNTS si elle existe', async () => {
      prisma.healthStructure.findFirst.mockResolvedValue({
        id: 'structure-1',
        name: 'CNTS de Dakar',
      });

      const result = await repository.findValidCntsById('structure-1');

      expect(prisma.healthStructure.findFirst).toHaveBeenCalledWith({
        where: { id: 'structure-1', structureType: StructureType.CNTS },
        select: { id: true, name: true },
      });
      expect(result).toEqual({ id: 'structure-1', name: 'CNTS de Dakar' });
    });
  });

  describe('findAvailableCnts', () => {
    it('retourne les CNTS vérifiées triées par région', async () => {
      prisma.healthStructure.findMany.mockResolvedValue([STRUCTURE]);

      const result = await repository.findAvailableCnts();

      expect(prisma.healthStructure.findMany).toHaveBeenCalledWith({
        where: {
          structureType: StructureType.CNTS,
          status: HealthStructureStatus.VERIFIED,
        },
        select: expect.objectContaining({ id: true, name: true, region: true }),
        orderBy: { region: 'asc' },
      });
      expect(result).toEqual([STRUCTURE]);
    });
  });

  describe('findAffiliatedHospitals', () => {
    it('retourne les hôpitaux affiliés à la CNTS', async () => {
      prisma.healthStructure.findMany.mockResolvedValue([STRUCTURE]);

      const result = await repository.findAffiliatedHospitals('cnts-1');

      expect(prisma.healthStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            affiliatedCntsId: 'cnts-1',
            structureType: {
              in: [StructureType.HOSPITAL, StructureType.HEALTH_CENTER],
            },
          }),
        }),
      );
      expect(result).toEqual([STRUCTURE]);
    });

    it('filtre par status si fourni', async () => {
      prisma.healthStructure.findMany.mockResolvedValue([]);

      await repository.findAffiliatedHospitals('cnts-1', {
        status: HealthStructureStatus.VERIFIED,
      });

      expect(prisma.healthStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: HealthStructureStatus.VERIFIED,
          }),
        }),
      );
    });
  });

  describe('findStaff', () => {
    it('retourne les agents de la structure triés par createdAt desc', async () => {
      prisma.user.findMany.mockResolvedValue([STAFF_MEMBER]);

      const result = await repository.findStaff('structure-1');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { healthStructureId: 'structure-1' },
        select: expect.objectContaining({ id: true, role: true }),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([STAFF_MEMBER]);
    });
  });

  describe('findStaffMember', () => {
    it('retourne un agent spécifique de la structure', async () => {
      prisma.user.findFirst.mockResolvedValue(STAFF_MEMBER);

      const result = await repository.findStaffMember('user-1', 'structure-1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'user-1', healthStructureId: 'structure-1' },
        select: expect.objectContaining({ id: true }),
      });
      expect(result).toEqual(STAFF_MEMBER);
    });

    it("retourne null si l'agent n'appartient pas à la structure", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await repository.findStaffMember(
        'user-autre',
        'structure-1',
      );

      expect(result).toBeNull();
    });
  });

  describe('addStaff', () => {
    it('crée un agent et le rattache à la structure', async () => {
      prisma.user.create.mockResolvedValue(STAFF_MEMBER);

      const input = {
        firstName: 'Awa',
        lastName: 'Diop',
        email: 'awa@cnts.sn',
        phone: '+221771234567',
        passwordHash: 'hashed',
        role: Role.CNTS_AGENT,
        isActive: true,
        healthStructureId: 'structure-1',
        isStructureAdmin: false,
      };

      const result = await repository.addStaff(input);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: input,
        select: expect.objectContaining({ id: true, role: true }),
      });
      expect(result).toEqual(STAFF_MEMBER);
    });
  });

  describe('removeStaff', () => {
    it("détache l'agent de la structure", async () => {
      prisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await repository.removeStaff('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { healthStructureId: null, isStructureAdmin: false },
        select: { id: true },
      });
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('updateStructure', () => {
    it('met à jour la structure avec les données fournies', async () => {
      prisma.healthStructure.update.mockResolvedValue({
        ...STRUCTURE,
        name: 'Nouveau Nom',
      });

      const result = await repository.updateStructure('structure-1', {
        name: 'Nouveau Nom',
      });

      expect(prisma.healthStructure.update).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        data: { name: 'Nouveau Nom' },
        select: expect.objectContaining({ id: true, name: true }),
      });
      expect(result.name).toBe('Nouveau Nom');
    });
  });

  describe('createCntsWithDirector', () => {
    it('crée la CNTS, le directeur et les stocks sanguins dans une transaction', async () => {
      const createdStructure = { ...STRUCTURE, id: 'cnts-new' };
      const createdDirector = {
        id: 'director-1',
        email: 'director@cnts.sn',
        role: Role.CNTS_ADMIN,
        isStructureAdmin: true,
        healthStructureId: 'cnts-new',
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          healthStructure: {
            create: jest.fn().mockResolvedValue(createdStructure),
          },
          user: { create: jest.fn().mockResolvedValue(createdDirector) },
          bloodStock: { createMany: jest.fn().mockResolvedValue({ count: 8 }) },
        };
        return cb(tx);
      });

      const result = await repository.createCntsWithDirector({
        firstName: 'Fatou',
        lastName: 'Ndiaye',
        email: 'director@cnts.sn',
        phone: '+221771234567',
        passwordHash: 'hashed',
        structureName: 'CNTS de Dakar',
        registrationNumber: 'REG-001',
        address: 'Route de Rufisque',
        region: 'Dakar',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.structure).toEqual(createdStructure);
      expect(result.director).toEqual(createdDirector);
    });

    it('crée les stocks sanguins pour tous les groupes sanguins', async () => {
      const bloodStockCreateMany = jest.fn().mockResolvedValue({ count: 8 });

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          healthStructure: { create: jest.fn().mockResolvedValue(STRUCTURE) },
          user: { create: jest.fn().mockResolvedValue({ id: 'director-1' }) },
          bloodStock: { createMany: bloodStockCreateMany },
        };
        return cb(tx);
      });

      await repository.createCntsWithDirector({
        firstName: 'Fatou',
        lastName: 'Ndiaye',
        email: 'director@cnts.sn',
        phone: '+221771234567',
        passwordHash: 'hashed',
        structureName: 'CNTS de Dakar',
        registrationNumber: 'REG-001',
        address: 'Route de Rufisque',
        region: 'Dakar',
      });

      expect(bloodStockCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining(
          Object.values(BloodType).map((bloodType) =>
            expect.objectContaining({
              bloodType,
              quantity: 0,
              level: BloodStockLevel.ADEQUATE,
            }),
          ),
        ),
      });
    });
  });

  describe('createHospitalWithDirector', () => {
    it("crée l'hôpital et le directeur dans une transaction", async () => {
      const createdStructure = {
        ...STRUCTURE,
        structureType: StructureType.HOSPITAL,
      };
      const createdDirector = {
        id: 'director-1',
        email: 'director@hospital.sn',
        role: Role.HOSPITAL_AGENT,
        isStructureAdmin: true,
        healthStructureId: 'hospital-new',
      };

      prisma.$transaction.mockImplementation((cb: any) => {
        const tx = {
          healthStructure: {
            create: jest.fn().mockResolvedValue(createdStructure),
          },
          user: { create: jest.fn().mockResolvedValue(createdDirector) },
        };
        return cb(tx);
      });

      const result = await repository.createHospitalWithDirector({
        firstName: 'Moussa',
        lastName: 'Diallo',
        email: 'director@hospital.sn',
        phone: '+221771234567',
        passwordHash: 'hashed',
        structureName: 'Hôpital Principal',
        registrationNumber: 'REG-002',
        address: 'Avenue Nelson Mandela',
        region: 'Dakar',
        structureType: StructureType.HOSPITAL,
        affiliatedCntsId: 'cnts-1',
      });

      expect(result.structure).toEqual(createdStructure);
      expect(result.director).toEqual(createdDirector);
    });
  });
});

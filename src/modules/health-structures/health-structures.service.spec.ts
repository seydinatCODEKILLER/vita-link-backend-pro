import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HealthStructuresService } from './health-structures.service';
import { HealthStructuresRepository } from './health-structures.repository';
import {
  HealthStructureStatus,
  Role,
  StructureType,
} from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { AddStaffDto } from './dto/add-staff.dto';

const createMockRepository = () => ({
  findAll: jest.fn(),
  findStructureById: jest.fn(),
  findByUserId: jest.fn(),
  findByRegistrationNumber: jest.fn(),
  findValidCntsById: jest.fn(),
  findAvailableCnts: jest.fn(),
  findAffiliatedHospitals: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserByPhone: jest.fn(),
  findStaff: jest.fn(),
  findStaffMember: jest.fn(),
  addStaff: jest.fn(),
  removeStaff: jest.fn(),
  updateStructure: jest.fn(),
  getStats: jest.fn(),
  createCntsWithDirector: jest.fn(),
  createHospitalWithDirector: jest.fn(),
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
  id: 'agent-1',
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa@cnts.sn',
  phone: '+221771234567',
  role: Role.CNTS_AGENT,
  isStructureAdmin: false,
  isActive: true,
  createdAt: new Date('2026-01-01'),
};

const BASE_STAFF_DTO: AddStaffDto = {
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa@cnts.sn',
  phone: '+221771234567',
  password: 'Motdepasse123!',
  isStructureAdmin: false,
};

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'admin-user-1',
  firstName: 'Fatou',
  lastName: 'Ndiaye',
  email: 'fatou@cnts.sn',
  role: Role.CNTS_ADMIN,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'structure-1',
  isStructureAdmin: true,
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

const CNTS_ADMIN = makeUser();
const NON_ADMIN = makeUser({ isStructureAdmin: false });
const HOSPITAL_ADMIN = makeUser({
  id: 'hospital-admin-1',
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
    affiliatedCntsId: 'structure-1',
  },
});

describe('HealthStructuresService', () => {
  let service: HealthStructuresService;
  let repository: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    repository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthStructuresService,
        { provide: HealthStructuresRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(HealthStructuresService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('délègue au repository findAll', async () => {
      repository.findAll.mockResolvedValue([STRUCTURE]);

      const result = await service.getAll();

      expect(repository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([STRUCTURE]);
    });
  });

  describe('getById', () => {
    it('retourne la structure trouvée', async () => {
      repository.findStructureById.mockResolvedValue(STRUCTURE);

      const result = await service.getById('structure-1');

      expect(result).toEqual(STRUCTURE);
    });

    it('lève NotFoundException si la structure est introuvable', async () => {
      repository.findStructureById.mockResolvedValue(null);

      await expect(service.getById('inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyStructure', () => {
    it("retourne la structure employeur de l'utilisateur", async () => {
      repository.findByUserId.mockResolvedValue({
        healthStructureId: 'structure-1',
        isStructureAdmin: true,
        employerStructure: STRUCTURE,
      });

      const result = await service.getMyStructure('user-1');

      expect(result).toEqual(STRUCTURE);
    });

    it("lève NotFoundException si l'utilisateur n'est rattaché à aucune structure", async () => {
      repository.findByUserId.mockResolvedValue({ employerStructure: null });

      await expect(service.getMyStructure('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats', () => {
    it('retourne les stats de la structure', async () => {
      repository.findStructureById.mockResolvedValue(STRUCTURE);
      repository.getStats.mockResolvedValue({ totalDonations: 45 });

      const result = await service.getStats(CNTS_ADMIN);

      expect(repository.getStats).toHaveBeenCalledWith(
        'structure-1',
        StructureType.CNTS,
      );
      expect(result).toEqual({ totalDonations: 45 });
    });

    it("lève NotFoundException si l'utilisateur n'a pas de structure", async () => {
      const userWithoutStructure = makeUser({ healthStructureId: null });

      await expect(service.getStats(userWithoutStructure)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStaff', () => {
    it('retourne la liste des agents pour un directeur', async () => {
      repository.findStaff.mockResolvedValue([STAFF_MEMBER]);

      const result = await service.getStaff(CNTS_ADMIN);

      expect(repository.findStaff).toHaveBeenCalledWith('structure-1');
      expect(result).toEqual([STAFF_MEMBER]);
    });

    it('lève ForbiddenException pour un non-directeur', () => {
      expect(() => service.getStaff(NON_ADMIN)).toThrow(ForbiddenException);
      expect(repository.findStaff).not.toHaveBeenCalled();
    });
  });

  describe('getAffiliatedHospitals', () => {
    it('retourne les hôpitaux affiliés pour une CNTS', async () => {
      repository.findAffiliatedHospitals.mockResolvedValue([STRUCTURE]);

      const result = await service.getAffiliatedHospitals(CNTS_ADMIN, {});

      expect(repository.findAffiliatedHospitals).toHaveBeenCalledWith(
        'structure-1',
        {},
      );
      expect(result).toEqual([STRUCTURE]);
    });

    it('lève ForbiddenException pour un hôpital', () => {
      expect(() => service.getAffiliatedHospitals(HOSPITAL_ADMIN, {})).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getAvailableCnts', () => {
    it('délègue au repository findAvailableCnts', async () => {
      repository.findAvailableCnts.mockResolvedValue([STRUCTURE]);

      const result = await service.getAvailableCnts();

      expect(repository.findAvailableCnts).toHaveBeenCalledTimes(1);
      expect(result).toEqual([STRUCTURE]);
    });
  });

  describe('updateMyStructure', () => {
    beforeEach(() => {
      repository.findByUserId.mockResolvedValue({
        healthStructureId: 'structure-1',
      });
      repository.updateStructure.mockResolvedValue({
        ...STRUCTURE,
        name: 'Nouveau Nom',
      });
    });

    it('met à jour la structure pour un directeur', async () => {
      const result = await service.updateMyStructure(CNTS_ADMIN, {
        name: 'Nouveau Nom',
      });

      expect(repository.updateStructure).toHaveBeenCalledWith('structure-1', {
        name: 'Nouveau Nom',
      });
      expect(result.name).toBe('Nouveau Nom');
    });

    it('lève ForbiddenException pour un non-directeur', async () => {
      await expect(
        service.updateMyStructure(NON_ADMIN, { name: 'X' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève BadRequestException si une CNTS tente de s'affilier", async () => {
      await expect(
        service.updateMyStructure(CNTS_ADMIN, {
          affiliatedCntsId: 'autre-cnts',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequestException si affiliatedCntsId ne pointe pas vers une CNTS valide', async () => {
      repository.findStructureById.mockResolvedValue({
        ...STRUCTURE,
        structureType: StructureType.HOSPITAL,
      });

      await expect(
        service.updateMyStructure(HOSPITAL_ADMIN, {
          affiliatedCntsId: 'hospital-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addStaff', () => {
    beforeEach(() => {
      repository.findUserByEmail.mockResolvedValue(null);
      repository.findUserByPhone.mockResolvedValue(null);
      repository.addStaff.mockResolvedValue(STAFF_MEMBER);
    });

    it('crée un agent CNTS_AGENT pour une CNTS', async () => {
      const result = await service.addStaff(CNTS_ADMIN, BASE_STAFF_DTO);

      expect(repository.addStaff).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'CNTS_AGENT' }),
      );
      expect(result).toEqual(STAFF_MEMBER);
    });

    it('crée un CNTS_ADMIN si isStructureAdmin est true pour une CNTS', async () => {
      await service.addStaff(CNTS_ADMIN, {
        ...BASE_STAFF_DTO,
        isStructureAdmin: true,
      });

      expect(repository.addStaff).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'CNTS_ADMIN' }),
      );
    });

    it('crée un HOSPITAL_AGENT pour un hôpital', async () => {
      const dto: AddStaffDto = {
        ...BASE_STAFF_DTO,
        email: 'moussa@hopital.sn',
        phone: '+221779876543',
      };

      await service.addStaff(HOSPITAL_ADMIN, dto);

      expect(repository.addStaff).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'HOSPITAL_AGENT' }),
      );
    });

    it('lève ForbiddenException pour un non-directeur', async () => {
      await expect(service.addStaff(NON_ADMIN, BASE_STAFF_DTO)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lève ConflictException si l'email est déjà utilisé", async () => {
      repository.findUserByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.addStaff(CNTS_ADMIN, {
          ...BASE_STAFF_DTO,
          email: 'taken@cnts.sn',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('lève ConflictException si le téléphone est déjà utilisé', async () => {
      repository.findUserByPhone.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.addStaff(CNTS_ADMIN, {
          ...BASE_STAFF_DTO,
          phone: '+221771111111',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeStaff', () => {
    it('retire un agent de la structure', async () => {
      repository.findStaffMember.mockResolvedValue(STAFF_MEMBER);
      repository.removeStaff.mockResolvedValue({ id: 'agent-1' });

      const result = await service.removeStaff(CNTS_ADMIN, 'agent-1');

      expect(repository.removeStaff).toHaveBeenCalledWith('agent-1');
      expect(result.message).toBeDefined();
    });

    it('lève ForbiddenException pour un non-directeur', async () => {
      await expect(service.removeStaff(NON_ADMIN, 'agent-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lève BadRequestException si l'admin tente de se retirer lui-même", async () => {
      await expect(
        service.removeStaff(CNTS_ADMIN, CNTS_ADMIN.id),
      ).rejects.toThrow(BadRequestException);
    });

    it("lève NotFoundException si l'agent n'appartient pas à la structure", async () => {
      repository.findStaffMember.mockResolvedValue(null);

      await expect(
        service.removeStaff(CNTS_ADMIN, 'agent-autre'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

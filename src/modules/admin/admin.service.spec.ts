import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { EventsService } from '@/events/events.service';
import { StructureType, HealthStructureStatus } from '@/generated/prisma/enums';

const createMockRepository = () => ({
  getDashboardKpis: jest.fn(),
  getMonthlyStats: jest.fn(),
  getRegionStats: jest.fn(),
  getRecentAlerts: jest.fn(),
  findUsers: jest.fn(),
  findUserById: jest.fn(),
  suspendUser: jest.fn(),
  reactivateUser: jest.fn(),
  findStructures: jest.fn(),
  findStructureById: jest.fn(),
  verifyStructure: jest.fn(),
  suspendStructure: jest.fn(),
  findAuditLogs: jest.fn(),
  ensureStockInitialized: jest.fn(),
});

const createMockEventsService = () => ({
  emitToStructure: jest.fn(),
});

const USER_DETAIL = {
  id: 'user-1',
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa.diop@example.com',
  phone: '+221770000000',
  role: 'DONOR' as const,
  bloodType: 'O_NEG' as const,
  gender: 'FEMALE' as const,
  isActive: true,
  isAvailable: true,
  isStructureAdmin: false,
  healthStructureId: null,
  createdAt: new Date('2026-06-01'),
  jambaarsProfile: {
    totalPoints: 500,
    currentGrade: 'SENTINELLE' as const,
    donationCount: 3,
    livesSavedEstimate: 9,
    noShowCount: 0,
    lastDonationAt: null,
    nextEligibilityAt: null,
    city: 'Dakar',
    district: null,
  },
  employerStructure: null,
  _count: { donations: 3, alertResponses: 4 },
};

const STRUCTURE_DETAIL_HOSPITAL = {
  id: 'structure-1',
  name: 'Hôpital Principal',
  structureType: StructureType.HOSPITAL,
  affiliatedCntsId: 'cnts-1',
  status: HealthStructureStatus.PENDING_REVIEW,
};

const STRUCTURE_DETAIL_CNTS = {
  id: 'cnts-1',
  name: 'CNTS de Dakar',
  structureType: StructureType.CNTS,
  affiliatedCntsId: null,
  status: HealthStructureStatus.PENDING_REVIEW,
};

describe('AdminService', () => {
  let service: AdminService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: AdminRepository, useValue: repository },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboard', () => {
    it('délègue au repository getDashboardKpis', async () => {
      const kpis = { totalDonors: 4500 };
      repository.getDashboardKpis.mockResolvedValue(kpis);

      const result = await service.getDashboard();

      expect(repository.getDashboardKpis).toHaveBeenCalled();
      expect(result).toEqual(kpis);
    });
  });

  describe('getMonthlyStats', () => {
    const currentYear = new Date().getFullYear();

    it("utilise l'année courante si aucune année n'est fournie", async () => {
      repository.getMonthlyStats.mockResolvedValue([]);

      await service.getMonthlyStats(undefined);

      expect(repository.getMonthlyStats).toHaveBeenCalledWith(currentYear);
    });

    it('utilise l’année fournie si elle est valide', async () => {
      repository.getMonthlyStats.mockResolvedValue([]);

      await service.getMonthlyStats(2023);

      expect(repository.getMonthlyStats).toHaveBeenCalledWith(2023);
    });

    it('accepte la borne basse 2020', async () => {
      repository.getMonthlyStats.mockResolvedValue([]);

      await service.getMonthlyStats(2020);

      expect(repository.getMonthlyStats).toHaveBeenCalledWith(2020);
    });

    it("accepte l'année courante comme borne haute", async () => {
      repository.getMonthlyStats.mockResolvedValue([]);

      await service.getMonthlyStats(currentYear);

      expect(repository.getMonthlyStats).toHaveBeenCalledWith(currentYear);
    });

    it('lève BadRequestException si année < 2020', () => {
      expect(() => service.getMonthlyStats(2019)).toThrow(BadRequestException);
      expect(repository.getMonthlyStats).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si année > année courante', () => {
      expect(() => service.getMonthlyStats(currentYear + 1)).toThrow(
        BadRequestException,
      );
      expect(repository.getMonthlyStats).not.toHaveBeenCalled();
    });
  });

  describe('getRegionStats', () => {
    it('délègue au repository getRegionStats', async () => {
      const stats = [{ region: 'Dakar', demandLevel: 80, donorsCount: 45 }];
      repository.getRegionStats.mockResolvedValue(stats);

      const result = await service.getRegionStats();

      expect(repository.getRegionStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });

  describe('getRecentAlerts', () => {
    it('délègue au repository avec la limite fournie', async () => {
      repository.getRecentAlerts.mockResolvedValue([]);

      await service.getRecentAlerts(25);

      expect(repository.getRecentAlerts).toHaveBeenCalledWith(25);
    });
  });

  describe('getUsers', () => {
    it('applique page=1 et limit=20 par défaut', async () => {
      repository.findUsers.mockResolvedValue({ data: [], total: 0 });

      await service.getUsers({});

      expect(repository.findUsers).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });

    it('transmet les filtres fournis avec page et limit personnalisés', async () => {
      repository.findUsers.mockResolvedValue({ data: [], total: 0 });

      await service.getUsers({ city: 'Dakar', page: 2, limit: 10 });

      expect(repository.findUsers).toHaveBeenCalledWith({
        city: 'Dakar',
        page: 2,
        limit: 10,
      });
    });
  });

  describe('getUserById', () => {
    it("retourne l'utilisateur trouvé", async () => {
      repository.findUserById.mockResolvedValue(USER_DETAIL);

      const result = await service.getUserById('user-1');

      expect(result).toEqual(USER_DETAIL);
    });

    it('lève NotFoundException si introuvable', async () => {
      repository.findUserById.mockResolvedValue(null);

      await expect(service.getUserById('inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('suspendUser', () => {
    beforeEach(() => {
      repository.findUserById.mockResolvedValue(USER_DETAIL);
      repository.suspendUser.mockResolvedValue({
        ...USER_DETAIL,
        isActive: false,
      });
    });

    it("suspend l'utilisateur actif", async () => {
      const result = await service.suspendUser(
        'user-1',
        'admin-1',
        'Trop de no-shows',
      );

      expect(repository.suspendUser).toHaveBeenCalledWith(
        'user-1',
        'admin-1',
        'Trop de no-shows',
      );
      expect(result).toEqual({
        ...USER_DETAIL,
        isActive: false,
      });
    });

    it('lève NotFoundException si introuvable', async () => {
      repository.findUserById.mockResolvedValue(null);

      await expect(
        service.suspendUser('inexistant', 'admin-1', undefined),
      ).rejects.toThrow(NotFoundException);
      expect(repository.suspendUser).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si déjà suspendu', async () => {
      repository.findUserById.mockResolvedValue({
        ...USER_DETAIL,
        isActive: false,
      });

      await expect(
        service.suspendUser('user-1', 'admin-1', undefined),
      ).rejects.toThrow(BadRequestException);
      expect(repository.suspendUser).not.toHaveBeenCalled();
    });
  });

  describe('reactivateUser', () => {
    beforeEach(() => {
      repository.findUserById.mockResolvedValue({
        ...USER_DETAIL,
        isActive: false,
      });
      repository.reactivateUser.mockResolvedValue({
        ...USER_DETAIL,
        isActive: true,
      });
    });

    it("réactive l'utilisateur suspendu", async () => {
      const result = await service.reactivateUser('user-1', 'admin-1');

      expect(repository.reactivateUser).toHaveBeenCalledWith(
        'user-1',
        'admin-1',
      );
      expect(result).toEqual({
        ...USER_DETAIL,
        isActive: true,
      });
    });

    it('lève NotFoundException si introuvable', async () => {
      repository.findUserById.mockResolvedValue(null);

      await expect(
        service.reactivateUser('inexistant', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.reactivateUser).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si déjà actif', async () => {
      repository.findUserById.mockResolvedValue({
        ...USER_DETAIL,
        isActive: true,
      });

      await expect(service.reactivateUser('user-1', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.reactivateUser).not.toHaveBeenCalled();
    });
  });

  describe('getStructures', () => {
    it('applique page=1 et limit=20 par défaut', async () => {
      repository.findStructures.mockResolvedValue({ data: [], total: 0 });

      await service.getStructures({});

      expect(repository.findStructures).toHaveBeenCalledWith({
        page: 1,
        limit: 20,
      });
    });

    it('transmet les filtres et pagination personnalisée', async () => {
      repository.findStructures.mockResolvedValue({ data: [], total: 0 });

      await service.getStructures({
        region: 'Dakar',
        page: 2,
        limit: 5,
      });

      expect(repository.findStructures).toHaveBeenCalledWith({
        region: 'Dakar',
        page: 2,
        limit: 5,
      });
    });
  });

  describe('verifyStructure', () => {
    it('vérifie un hôpital affilié à une CNTS sans initialiser de stock', async () => {
      repository.findStructureById.mockResolvedValue(STRUCTURE_DETAIL_HOSPITAL);
      repository.verifyStructure.mockResolvedValue({
        id: 'structure-1',
        name: 'Hôpital Principal',
        status: HealthStructureStatus.VERIFIED,
        verifiedAt: new Date('2026-06-29'),
      });

      const result = await service.verifyStructure('structure-1', 'admin-1');

      expect(repository.verifyStructure).toHaveBeenCalledWith(
        'structure-1',
        'admin-1',
      );
      expect(repository.ensureStockInitialized).not.toHaveBeenCalled();
      expect(events.emitToStructure).toHaveBeenCalledWith(
        'structure-1',
        'structure:verified',
        expect.objectContaining({
          structureId: 'structure-1',
          status: 'VERIFIED',
        }),
      );
      expect(result.status).toBe(HealthStructureStatus.VERIFIED);
    });

    it('vérifie une CNTS et initialise son stock sanguin', async () => {
      repository.findStructureById.mockResolvedValue(STRUCTURE_DETAIL_CNTS);
      repository.verifyStructure.mockResolvedValue({
        id: 'cnts-1',
        name: 'CNTS de Dakar',
        status: HealthStructureStatus.VERIFIED,
        verifiedAt: new Date('2026-06-29'),
      });

      await service.verifyStructure('cnts-1', 'admin-1');

      expect(repository.ensureStockInitialized).toHaveBeenCalledWith('cnts-1');
    });

    it('lève NotFoundException si la structure est introuvable', async () => {
      repository.findStructureById.mockResolvedValue(null);

      await expect(
        service.verifyStructure('inexistant', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
      expect(repository.verifyStructure).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si l'hôpital n'a pas de CNTS affiliée", async () => {
      repository.findStructureById.mockResolvedValue({
        ...STRUCTURE_DETAIL_HOSPITAL,
        affiliatedCntsId: null,
      });

      await expect(
        service.verifyStructure('structure-1', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.verifyStructure).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si le centre de santé n'a pas de CNTS affiliée", async () => {
      repository.findStructureById.mockResolvedValue({
        id: 'structure-2',
        name: 'Centre de Santé Y',
        structureType: StructureType.HEALTH_CENTER,
        affiliatedCntsId: null,
        status: HealthStructureStatus.PENDING_REVIEW,
      });

      await expect(
        service.verifyStructure('structure-2', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.verifyStructure).not.toHaveBeenCalled();
    });

    it("n'exige pas de CNTS affiliée pour une CNTS elle-même", async () => {
      repository.findStructureById.mockResolvedValue(STRUCTURE_DETAIL_CNTS);
      repository.verifyStructure.mockResolvedValue({
        id: 'cnts-1',
        name: 'CNTS de Dakar',
        status: HealthStructureStatus.VERIFIED,
        verifiedAt: new Date(),
      });

      await expect(
        service.verifyStructure('cnts-1', 'admin-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('suspendStructure', () => {
    it('suspend la structure trouvée', async () => {
      repository.findStructureById.mockResolvedValue(STRUCTURE_DETAIL_HOSPITAL);
      repository.suspendStructure.mockResolvedValue({
        id: 'structure-1',
        name: 'Hôpital Principal',
        status: HealthStructureStatus.SUSPENDED,
      });

      const result = await service.suspendStructure(
        'structure-1',
        'admin-1',
        'Agrément périmé',
      );

      expect(repository.suspendStructure).toHaveBeenCalledWith(
        'structure-1',
        'admin-1',
        'Agrément périmé',
      );
      expect(result.status).toBe(HealthStructureStatus.SUSPENDED);
    });

    it('lève NotFoundException si la structure est introuvable', async () => {
      repository.findStructureById.mockResolvedValue(null);

      await expect(
        service.suspendStructure('inexistant', 'admin-1', undefined),
      ).rejects.toThrow(NotFoundException);
      expect(repository.suspendStructure).not.toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('applique page=1 et limit=50 par défaut', async () => {
      repository.findAuditLogs.mockResolvedValue({ data: [], total: 0 });

      await service.getAuditLogs({});

      expect(repository.findAuditLogs).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
      });
    });

    it('transmet les filtres et la pagination personnalisée', async () => {
      repository.findAuditLogs.mockResolvedValue({ data: [], total: 0 });

      await service.getAuditLogs({
        action: 'SUSPENDED',
        page: 2,
        limit: 10,
      });

      expect(repository.findAuditLogs).toHaveBeenCalledWith({
        action: 'SUSPENDED',
        page: 2,
        limit: 10,
      });
    });
  });
});

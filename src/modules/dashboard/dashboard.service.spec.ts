import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { StructureType } from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';

const createMockRepository = () => ({
  getCntsDashboardData: jest.fn(),
  getHospitalDashboardData: jest.fn(),
});

type EmployerStructure = NonNullable<AuthenticatedUser['employerStructure']>;

const buildStructure = (
  overrides: Partial<EmployerStructure> = {},
): EmployerStructure => ({
  id: 'structure-1',
  name: 'Structure de test',
  status: 'VERIFIED',
  isVerified: true,
  address: 'Adresse de test, Dakar',
  latitude: 14.6928,
  longitude: -17.4467,
  structureType: StructureType.CNTS,
  affiliatedCntsId: null,
  ...overrides,
});

const buildUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser =>
  ({
    id: 'user-1',
    healthStructureId: 'structure-1',
    employerStructure: buildStructure(),
    ...overrides,
  }) as AuthenticatedUser;

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    repository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DashboardRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCntsDashboard', () => {
    it('délègue au repository avec le bon healthStructureId et la limite fournie', async () => {
      const user = buildUser({
        healthStructureId: 'cnts-1',
        employerStructure: buildStructure({ id: 'cnts-1' }),
      });
      const fakeData = {
        kpis: {
          pendingRequests: 4,
          criticalStocks: 2,
          activeAlerts: 1,
          totalDonations: 150,
        },
        bloodStocks: [],
        recentRequests: [],
      };
      repository.getCntsDashboardData.mockResolvedValue(fakeData);

      const result = await service.getCntsDashboard(user, {
        recentRequestsLimit: 10,
      });

      expect(repository.getCntsDashboardData).toHaveBeenCalledWith(
        'cnts-1',
        10,
      );
      expect(result).toEqual(fakeData);
    });

    it('utilise la limite par défaut (5) si recentRequestsLimit est absent', async () => {
      const user = buildUser();
      repository.getCntsDashboardData.mockResolvedValue({
        kpis: {
          pendingRequests: 0,
          criticalStocks: 0,
          activeAlerts: 0,
          totalDonations: 0,
        },
        bloodStocks: [],
        recentRequests: [],
      });

      await service.getCntsDashboard(user, {});

      expect(repository.getCntsDashboardData).toHaveBeenCalledWith(
        'structure-1',
        5,
      );
    });

    it("lève ForbiddenException si l'utilisateur n'est pas rattaché à une CNTS", async () => {
      const user = buildUser({
        employerStructure: buildStructure({
          id: 'hospital-1',
          structureType: StructureType.HOSPITAL,
          affiliatedCntsId: 'cnts-1',
        }),
      });

      await expect(
        service.getCntsDashboard(user, { recentRequestsLimit: 5 }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.getCntsDashboardData).not.toHaveBeenCalled();
    });

    it("lève ForbiddenException si l'utilisateur n'a aucune structure", async () => {
      const user = buildUser({ employerStructure: undefined });

      await expect(
        service.getCntsDashboard(user, { recentRequestsLimit: 5 }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.getCntsDashboardData).not.toHaveBeenCalled();
    });
  });

  describe('getHospitalDashboard', () => {
    it('délègue au repository pour un HOSPITAL avec affiliatedCntsId', async () => {
      const user = buildUser({
        healthStructureId: 'hospital-1',
        employerStructure: buildStructure({
          id: 'hospital-1',
          structureType: StructureType.HOSPITAL,
          affiliatedCntsId: 'cnts-1',
        }),
      });
      const fakeData = {
        kpis: { pendingRequests: 2, activeDirectAlerts: 0, totalDonations: 45 },
        myRequests: [],
        cntsStock: [],
      };
      repository.getHospitalDashboardData.mockResolvedValue(fakeData);

      const result = await service.getHospitalDashboard(user, {
        myRequestsLimit: 8,
      });

      expect(repository.getHospitalDashboardData).toHaveBeenCalledWith(
        'hospital-1',
        'cnts-1',
        8,
      );
      expect(result).toEqual(fakeData);
    });

    it('délègue avec affiliatedCntsId = null pour un HEALTH_CENTER non affilié', async () => {
      const user = buildUser({
        healthStructureId: 'center-1',
        employerStructure: buildStructure({
          id: 'center-1',
          structureType: StructureType.HEALTH_CENTER,
          affiliatedCntsId: null,
        }),
      });
      repository.getHospitalDashboardData.mockResolvedValue({
        kpis: { pendingRequests: 0, activeDirectAlerts: 0, totalDonations: 0 },
        myRequests: [],
        cntsStock: [],
      });

      await service.getHospitalDashboard(user, {});

      expect(repository.getHospitalDashboardData).toHaveBeenCalledWith(
        'center-1',
        null,
        5,
      );
    });

    it('lève ForbiddenException pour une structure de type CNTS', async () => {
      const user = buildUser({
        employerStructure: buildStructure({
          id: 'cnts-1',
          structureType: StructureType.CNTS,
          affiliatedCntsId: null,
        }),
      });

      await expect(
        service.getHospitalDashboard(user, { myRequestsLimit: 5 }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.getHospitalDashboardData).not.toHaveBeenCalled();
    });

    it("lève ForbiddenException si l'utilisateur n'a aucune structure", async () => {
      const user = buildUser({ employerStructure: undefined });

      await expect(
        service.getHospitalDashboard(user, { myRequestsLimit: 5 }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.getHospitalDashboardData).not.toHaveBeenCalled();
    });
  });
});

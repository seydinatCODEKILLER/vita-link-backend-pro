import { Test, TestingModule } from '@nestjs/testing';
import { DashboardRepository } from './dashboard.repository';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AlertOrigin,
  AlertStatus,
  BloodRequestStatus,
  BloodStockLevel,
} from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  bloodRequest: { count: jest.fn(), findMany: jest.fn() },
  bloodStock: { count: jest.fn(), findMany: jest.fn() },
  alert: { count: jest.fn() },
  donation: { count: jest.fn() },
});

describe('DashboardRepository', () => {
  let repository: DashboardRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(DashboardRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCntsDashboardData', () => {
    it('agrège les 4 KPIs, le stock complet et les demandes récentes', async () => {
      prisma.bloodRequest.count.mockResolvedValue(4);
      prisma.bloodStock.count.mockResolvedValue(2);
      prisma.alert.count.mockResolvedValue(1);
      prisma.donation.count.mockResolvedValue(150);
      const fakeStocks = [{ bloodType: 'O_NEG', quantity: 2, level: 'LOW' }];
      prisma.bloodStock.findMany.mockResolvedValue(fakeStocks);
      const fakeRequests = [{ id: 'req-1', bloodType: 'O_NEG' }];
      prisma.bloodRequest.findMany.mockResolvedValue(fakeRequests);

      const result = await repository.getCntsDashboardData('cnts-1', 10);

      expect(prisma.bloodRequest.count).toHaveBeenCalledWith({
        where: {
          handledByCntsId: 'cnts-1',
          status: BloodRequestStatus.PENDING,
        },
      });
      expect(prisma.bloodStock.count).toHaveBeenCalledWith({
        where: { healthStructureId: 'cnts-1', level: BloodStockLevel.CRITICAL },
      });
      expect(prisma.alert.count).toHaveBeenCalledWith({
        where: { healthStructureId: 'cnts-1', status: AlertStatus.ACTIVE },
      });
      expect(prisma.donation.count).toHaveBeenCalledWith({
        where: { healthStructureId: 'cnts-1', isDone: true },
      });
      expect(prisma.bloodStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { healthStructureId: 'cnts-1' },
          orderBy: { bloodType: 'asc' },
        }),
      );
      expect(prisma.bloodRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            handledByCntsId: 'cnts-1',
            status: BloodRequestStatus.PENDING,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );

      expect(result).toEqual({
        kpis: {
          pendingRequests: 4,
          criticalStocks: 2,
          activeAlerts: 1,
          totalDonations: 150,
        },
        bloodStocks: fakeStocks,
        recentRequests: fakeRequests,
      });
    });

    it('utilise recentRequestsLimit = 5 par défaut si non fourni', async () => {
      prisma.bloodRequest.count.mockResolvedValue(0);
      prisma.bloodStock.count.mockResolvedValue(0);
      prisma.alert.count.mockResolvedValue(0);
      prisma.donation.count.mockResolvedValue(0);
      prisma.bloodStock.findMany.mockResolvedValue([]);
      prisma.bloodRequest.findMany.mockResolvedValue([]);

      await repository.getCntsDashboardData('cnts-1');

      expect(prisma.bloodRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe('getHospitalDashboardData', () => {
    it('agrège les KPIs hôpital avec origin HOSPITAL_DIRECT pour les alertes', async () => {
      prisma.bloodRequest.count.mockResolvedValue(2);
      prisma.alert.count.mockResolvedValue(0);
      prisma.donation.count.mockResolvedValue(45);
      const fakeMyRequests = [{ id: 'req-1' }];
      prisma.bloodRequest.findMany.mockResolvedValue(fakeMyRequests);
      const fakeCntsStock = [{ bloodType: 'O_NEG', quantity: 2, level: 'LOW' }];
      prisma.bloodStock.findMany.mockResolvedValue(fakeCntsStock);

      const result = await repository.getHospitalDashboardData(
        'hospital-1',
        'cnts-1',
        5,
      );

      expect(prisma.bloodRequest.count).toHaveBeenCalledWith({
        where: {
          requestingHospitalId: 'hospital-1',
          status: BloodRequestStatus.PENDING,
        },
      });
      expect(prisma.alert.count).toHaveBeenCalledWith({
        where: {
          healthStructureId: 'hospital-1',
          status: AlertStatus.ACTIVE,
          origin: AlertOrigin.HOSPITAL_DIRECT,
        },
      });
      expect(prisma.bloodRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            requestingHospitalId: 'hospital-1',
            status: {
              in: [
                BloodRequestStatus.PENDING,
                BloodRequestStatus.PARTIALLY_FULFILLED,
                BloodRequestStatus.ESCALATED_TO_ALERT,
              ],
            },
          },
        }),
      );
      expect(prisma.bloodStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { healthStructureId: 'cnts-1' } }),
      );

      expect(result).toEqual({
        kpis: { pendingRequests: 2, activeDirectAlerts: 0, totalDonations: 45 },
        myRequests: fakeMyRequests,
        cntsStock: fakeCntsStock,
      });
    });

    it('retourne cntsStock vide sans appeler bloodStock.findMany si affiliatedCntsId est null', async () => {
      prisma.bloodRequest.count.mockResolvedValue(0);
      prisma.alert.count.mockResolvedValue(0);
      prisma.donation.count.mockResolvedValue(0);
      prisma.bloodRequest.findMany.mockResolvedValue([]);

      const result = await repository.getHospitalDashboardData(
        'hospital-1',
        null,
        5,
      );

      expect(prisma.bloodStock.findMany).not.toHaveBeenCalled();
      expect(result.cntsStock).toEqual([]);
    });

    it('utilise myRequestsLimit = 5 par défaut si non fourni', async () => {
      prisma.bloodRequest.count.mockResolvedValue(0);
      prisma.alert.count.mockResolvedValue(0);
      prisma.donation.count.mockResolvedValue(0);
      prisma.bloodRequest.findMany.mockResolvedValue([]);

      await repository.getHospitalDashboardData('hospital-1', null);

      expect(prisma.bloodRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});

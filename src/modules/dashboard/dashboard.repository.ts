import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  AlertOrigin,
  AlertStatus,
  BloodRequestStatus,
  BloodStockLevel,
} from '@/generated/prisma/enums';

const BLOOD_STOCK_SUMMARY_SELECT = {
  bloodType: true,
  quantity: true,
  level: true,
} as const;

const RECENT_REQUEST_SELECT = {
  id: true,
  bloodType: true,
  quantityNeeded: true,
  urgencyLevel: true,
  status: true,
  createdAt: true,
  requestingHospital: {
    select: { id: true, name: true, region: true },
  },
} as const;

const MY_REQUEST_SELECT = {
  id: true,
  bloodType: true,
  quantityNeeded: true,
  quantityProvided: true,
  status: true,
  urgencyLevel: true,
  createdAt: true,
} as const;

export type BloodStockSummary = Prisma.BloodStockGetPayload<{
  select: typeof BLOOD_STOCK_SUMMARY_SELECT;
}>;

export type RecentRequest = Prisma.BloodRequestGetPayload<{
  select: typeof RECENT_REQUEST_SELECT;
}>;

export type MyRequest = Prisma.BloodRequestGetPayload<{
  select: typeof MY_REQUEST_SELECT;
}>;

export interface CntsDashboardData {
  kpis: {
    pendingRequests: number;
    criticalStocks: number;
    activeAlerts: number;
    totalDonations: number;
  };
  bloodStocks: BloodStockSummary[];
  recentRequests: RecentRequest[];
}

export interface HospitalDashboardData {
  kpis: {
    pendingRequests: number;
    activeDirectAlerts: number;
    totalDonations: number;
  };
  myRequests: MyRequest[];
  cntsStock: BloodStockSummary[];
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── KPIs & Données CNTS ───────────────────────────────────
  async getCntsDashboardData(
    cntsId: string,
    recentRequestsLimit = 5,
  ): Promise<CntsDashboardData> {
    const [pendingRequests, criticalStocks, activeAlerts, totalDonations] =
      await Promise.all([
        this.prisma.bloodRequest.count({
          where: {
            handledByCntsId: cntsId,
            status: BloodRequestStatus.PENDING,
          },
        }),
        this.prisma.bloodStock.count({
          where: {
            healthStructureId: cntsId,
            level: BloodStockLevel.CRITICAL,
          },
        }),
        this.prisma.alert.count({
          where: { healthStructureId: cntsId, status: AlertStatus.ACTIVE },
        }),
        this.prisma.donation.count({
          where: { healthStructureId: cntsId, isDone: true },
        }),
      ]);

    const bloodStocks = (await this.prisma.bloodStock.findMany({
      where: { healthStructureId: cntsId },
      select: BLOOD_STOCK_SUMMARY_SELECT,
      orderBy: { bloodType: 'asc' },
    })) as BloodStockSummary[];

    const recentRequests = (await this.prisma.bloodRequest.findMany({
      where: {
        handledByCntsId: cntsId,
        status: BloodRequestStatus.PENDING,
      },
      take: recentRequestsLimit,
      orderBy: { createdAt: 'desc' },
      select: RECENT_REQUEST_SELECT,
    })) as RecentRequest[];

    return {
      kpis: { pendingRequests, criticalStocks, activeAlerts, totalDonations },
      bloodStocks,
      recentRequests,
    };
  }

  // ─── KPIs & Données HÔPITAL ────────────────────────────────
  async getHospitalDashboardData(
    hospitalId: string,
    affiliatedCntsId: string | null,
    myRequestsLimit = 5,
  ): Promise<HospitalDashboardData> {
    const [pendingRequests, activeDirectAlerts, totalDonations] =
      await Promise.all([
        this.prisma.bloodRequest.count({
          where: {
            requestingHospitalId: hospitalId,
            status: BloodRequestStatus.PENDING,
          },
        }),
        this.prisma.alert.count({
          where: {
            healthStructureId: hospitalId,
            status: AlertStatus.ACTIVE,
            origin: AlertOrigin.HOSPITAL_DIRECT,
          },
        }),
        this.prisma.donation.count({
          where: { healthStructureId: hospitalId, isDone: true },
        }),
      ]);

    const myRequests = (await this.prisma.bloodRequest.findMany({
      where: {
        requestingHospitalId: hospitalId,
        status: {
          in: [
            BloodRequestStatus.PENDING,
            BloodRequestStatus.PARTIALLY_FULFILLED,
            BloodRequestStatus.ESCALATED_TO_ALERT,
          ],
        },
      },
      take: myRequestsLimit,
      orderBy: { createdAt: 'desc' },
      select: MY_REQUEST_SELECT,
    })) as MyRequest[];

    let cntsStock: BloodStockSummary[] = [];
    if (affiliatedCntsId) {
      cntsStock = await this.prisma.bloodStock.findMany({
        where: { healthStructureId: affiliatedCntsId },
        select: BLOOD_STOCK_SUMMARY_SELECT,
        orderBy: { bloodType: 'asc' },
      });
    }

    return {
      kpis: { pendingRequests, activeDirectAlerts, totalDonations },
      myRequests,
      cntsStock,
    };
  }
}

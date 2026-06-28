import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import {
  Role,
  BloodType,
  AlertStatus,
  BloodStockLevel,
  HealthStructureStatus,
  StructureType,
} from '@/generated/prisma/enums';

interface AvgResponseTimeRow {
  avg_minutes: string | null;
}

interface MonthlyCountRow {
  month: string;
  donations?: number;
  alerts?: number;
}

interface MonthlyLivesRow {
  month: string;
  livesSaved: number;
}

const USER_ADMIN_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  bloodType: true,
  isActive: true,
  isAvailable: true,
  createdAt: true,
  jambaarsProfile: {
    select: {
      totalPoints: true,
      currentGrade: true,
      donationCount: true,
      noShowCount: true,
      city: true,
    },
  },
} as const;

const USER_ADMIN_DETAIL_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  bloodType: true,
  gender: true,
  isActive: true,
  isAvailable: true,
  isStructureAdmin: true,
  healthStructureId: true,
  createdAt: true,
  jambaarsProfile: {
    select: {
      totalPoints: true,
      currentGrade: true,
      donationCount: true,
      livesSavedEstimate: true,
      noShowCount: true,
      lastDonationAt: true,
      nextEligibilityAt: true,
      city: true,
      district: true,
    },
  },
  employerStructure: {
    select: { id: true, name: true, status: true, region: true },
  },
  _count: {
    select: { donations: true, alertResponses: true },
  },
} as const;

const STRUCTURE_ADMIN_LIST_SELECT = {
  id: true,
  name: true,
  structureType: true,
  registrationNumber: true,
  address: true,
  region: true,
  phone: true,
  email: true,
  isVerified: true,
  status: true,
  verifiedAt: true,
  affiliatedCntsId: true,
  createdAt: true,
  _count: {
    select: { staffMembers: true, alerts: true, donations: true },
  },
} as const;

const AUDIT_LOG_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  details: true,
  ipAddress: true,
  createdAt: true,
  user: {
    select: { id: true, firstName: true, lastName: true, role: true },
  },
} as const;

export type UserAdminListItem = Prisma.UserGetPayload<{
  select: typeof USER_ADMIN_LIST_SELECT;
}>;

export type UserAdminDetail = Prisma.UserGetPayload<{
  select: typeof USER_ADMIN_DETAIL_SELECT;
}>;

export type StructureAdminListItem = Prisma.HealthStructureGetPayload<{
  select: typeof STRUCTURE_ADMIN_LIST_SELECT;
}>;

export type AuditLogEntry = Prisma.AuditLogGetPayload<{
  select: typeof AUDIT_LOG_SELECT;
}>;

export interface DashboardKpis {
  totalDonors: number;
  totalStructures: number;
  totalDonations: number;
  totalAlerts: number;
  avgResponseTimeMinutes: number | null;
  criticalStocksCount: number;
  livesSavedEstimate: number;
  pendingStructures: number;
}

export interface MonthlyStat {
  month: string;
  donations: number;
  alerts: number;
  livesSaved: number;
}

export interface RegionStat {
  region: string;
  demandLevel: number;
  donorsCount: number;
}

export interface RecentAlertItem {
  id: string;
  structureName: string;
  region: string;
  bloodGroup: string;
  status: AlertStatus;
  createdAt: Date;
}

const ALL_BLOOD_TYPES = Object.values(BloodType);

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard KPIs ────────────────────────────────────────

  async getDashboardKpis(): Promise<DashboardKpis> {
    const [
      totalDonors,
      totalStructures,
      totalDonations,
      totalAlerts,
      avgResponseTimeRows,
      criticalStocks,
      livesSaved,
      pendingStructures,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.DONOR, isActive: true } }),
      this.prisma.healthStructure.count({
        where: { status: HealthStructureStatus.VERIFIED },
      }),
      this.prisma.donation.count({ where: { isDone: true } }),
      this.prisma.alert.count({
        where: { status: AlertStatus.QUOTA_REACHED },
      }),
      this.prisma.$queryRaw<AvgResponseTimeRow[]>`
        SELECT ROUND(
          AVG(
            EXTRACT(EPOCH FROM (ar."arrivedAt" - a."createdAt")) / 60
          )::numeric, 1
        ) as avg_minutes
        FROM alert_responses ar
        JOIN alerts a ON a.id = ar."alertId"
        WHERE ar."arrivedAt" IS NOT NULL
      `,
      this.prisma.bloodStock.groupBy({
        by: ['healthStructureId'],
        where: { level: BloodStockLevel.CRITICAL },
        _count: { healthStructureId: true },
      }),
      this.prisma.jambaarsProfile.aggregate({
        _sum: { livesSavedEstimate: true },
      }),
      this.prisma.healthStructure.count({
        where: { status: HealthStructureStatus.PENDING_REVIEW },
      }),
    ]);

    return {
      totalDonors,
      totalStructures,
      totalDonations,
      totalAlerts,
      avgResponseTimeMinutes: avgResponseTimeRows[0]?.avg_minutes
        ? Number(avgResponseTimeRows[0].avg_minutes)
        : null,
      criticalStocksCount: criticalStocks.length,
      livesSavedEstimate: livesSaved._sum.livesSavedEstimate ?? 0,
      pendingStructures,
    };
  }

  // ─── Users ─────────────────────────────────────────────────

  findUsers(filters: {
    role?: Role;
    bloodType?: BloodType;
    city?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }): Promise<{ data: UserAdminListItem[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      ...(filters.role && { role: filters.role }),
      ...(filters.bloodType && { bloodType: filters.bloodType }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.city && {
        jambaarsProfile: {
          city: { contains: filters.city, mode: 'insensitive' },
        },
      }),
    };

    return Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_ADMIN_LIST_SELECT,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }) as Promise<UserAdminListItem[]>,
      this.prisma.user.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  }

  findUserById(id: string): Promise<UserAdminDetail | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_ADMIN_DETAIL_SELECT,
    });
  }

  suspendUser(
    targetId: string,
    adminId: string,
    reason: string | undefined,
  ): Promise<{ id: string; firstName: string; lastName: string; role: Role }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetId },
        data: {
          isActive: false,
          refreshToken: null,
          refreshTokenExpiresAt: null,
        },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'USER_SUSPENDED',
          entityType: 'USER',
          entityId: targetId,
          details: reason ? JSON.stringify({ reason }) : null,
        },
      });
      return user;
    });
  }

  reactivateUser(
    targetId: string,
    adminId: string,
  ): Promise<{ id: string; firstName: string; lastName: string; role: Role }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetId },
        data: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'USER_REACTIVATED',
          entityType: 'USER',
          entityId: targetId,
        },
      });
      return user;
    });
  }

  // ─── Health Structures ─────────────────────────────────────

  findStructures(filters: {
    status?: HealthStructureStatus;
    structureType?: StructureType;
    region?: string;
    page: number;
    limit: number;
  }): Promise<{ data: StructureAdminListItem[]; total: number }> {
    const where: Prisma.HealthStructureWhereInput = {
      ...(filters.status && { status: filters.status }),
      ...(filters.structureType && { structureType: filters.structureType }),
      ...(filters.region && { region: filters.region }),
    };

    return Promise.all([
      this.prisma.healthStructure.findMany({
        where,
        select: STRUCTURE_ADMIN_LIST_SELECT,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }) as Promise<StructureAdminListItem[]>,
      this.prisma.healthStructure.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  }

  verifyStructure(
    id: string,
    adminId: string,
  ): Promise<{
    id: string;
    name: string;
    status: HealthStructureStatus;
    verifiedAt: Date | null;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.healthStructure.update({
        where: { id },
        data: {
          isVerified: true,
          status: HealthStructureStatus.VERIFIED,
          verifiedAt: new Date(),
        },
        select: { id: true, name: true, status: true, verifiedAt: true },
      });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'STRUCTURE_VERIFIED',
          entityType: 'HEALTH_STRUCTURE',
          entityId: id,
        },
      });
      return structure;
    });
  }

  suspendStructure(
    id: string,
    adminId: string,
    reason: string | undefined,
  ): Promise<{ id: string; name: string; status: HealthStructureStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.healthStructure.update({
        where: { id },
        data: {
          status: HealthStructureStatus.SUSPENDED,
          isVerified: false,
        },
        select: { id: true, name: true, status: true },
      });
      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'STRUCTURE_SUSPENDED',
          entityType: 'HEALTH_STRUCTURE',
          entityId: id,
          details: reason ? JSON.stringify({ reason }) : null,
        },
      });
      return structure;
    });
  }

  // ─── Audit Logs ────────────────────────────────────────────

  findAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    page: number;
    limit: number;
  }): Promise<{ data: AuditLogEntry[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.entityId && { entityId: filters.entityId }),
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.action && {
        action: { contains: filters.action, mode: 'insensitive' },
      }),
    };

    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: AUDIT_LOG_SELECT,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }) as Promise<AuditLogEntry[]>,
      this.prisma.auditLog.count({ where }),
    ]).then(([data, total]) => ({ data, total }));
  }

  findStructureById(id: string): Promise<{
    id: string;
    name: string;
    structureType: StructureType;
    affiliatedCntsId: string | null;
    status: HealthStructureStatus;
  } | null> {
    return this.prisma.healthStructure.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        structureType: true,
        affiliatedCntsId: true,
        status: true,
      },
    });
  }

  // ─── Alertes Récentes ────────────────────────────────────────

  async getRecentAlerts(limit = 10): Promise<RecentAlertItem[]> {
    const alerts = await this.prisma.alert.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        bloodType: true,
        createdAt: true,
        healthStructure: {
          select: { name: true, region: true },
        },
      },
    });

    return alerts.map((alert) => ({
      id: alert.id,
      structureName: alert.healthStructure.name,
      region: alert.healthStructure.region ?? 'Non spécifiée',
      bloodGroup: alert.bloodType.replace('_', ''),
      status: alert.status,
      createdAt: alert.createdAt,
    }));
  }

  // ─── Statistiques Mensuelles ────────────────────────────────

  async getMonthlyStats(year: number): Promise<MonthlyStat[]> {
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

    const donationsByMonth = await this.prisma.$queryRaw<MonthlyCountRow[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "donatedAt"), 'Mon') AS month, COUNT(*)::int AS donations
      FROM donations WHERE "donatedAt" >= ${startDate} AND "donatedAt" <= ${endDate} AND "isDone" = true
      GROUP BY DATE_TRUNC('month', "donatedAt") ORDER BY DATE_TRUNC('month', "donatedAt") ASC
    `;

    const alertsByMonth = await this.prisma.$queryRaw<MonthlyCountRow[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon') AS month, COUNT(*)::int AS alerts
      FROM alerts WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY DATE_TRUNC('month', "createdAt") ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `;

    const livesByMonth = await this.prisma.$queryRaw<MonthlyLivesRow[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', d."donatedAt"), 'Mon') AS month, COALESCE(SUM(jp."livesSavedEstimate"), 0)::int AS "livesSaved"
      FROM donations d JOIN users u ON u.id = d."donorId" JOIN jambars_profiles jp ON jp."userId" = u.id
      WHERE d."donatedAt" >= ${startDate} AND d."donatedAt" <= ${endDate} AND d."isDone" = true
      GROUP BY DATE_TRUNC('month', d."donatedAt") ORDER BY DATE_TRUNC('month', d."donatedAt") ASC
    `;

    const monthsOrder = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const localizedMonths = [
      'Jan',
      'Fév',
      'Mar',
      'Avr',
      'Mai',
      'Juin',
      'Juil',
      'Aoû',
      'Sep',
      'Oct',
      'Nov',
      'Déc',
    ];

    const statsMap: Record<string, MonthlyStat> = {};
    monthsOrder.forEach((m, index) => {
      statsMap[m] = {
        month: localizedMonths[index],
        donations: 0,
        alerts: 0,
        livesSaved: 0,
      };
    });

    donationsByMonth.forEach((row) => {
      if (statsMap[row.month] && row.donations !== undefined) {
        statsMap[row.month].donations = row.donations;
      }
    });
    alertsByMonth.forEach((row) => {
      if (statsMap[row.month] && row.alerts !== undefined) {
        statsMap[row.month].alerts = row.alerts;
      }
    });
    livesByMonth.forEach((row) => {
      if (statsMap[row.month]) {
        statsMap[row.month].livesSaved = Number(row.livesSaved);
      }
    });

    return Object.values(statsMap);
  }

  // ─── Heatmap par Région ────────────────────────────────────

  async getRegionStats(): Promise<RegionStat[]> {
    const donorsByCity = await this.prisma.jambaarsProfile.groupBy({
      by: ['city'],
      where: {
        city: { not: null },
        user: { role: Role.DONOR, isActive: true },
      },
      _count: { city: true },
    });

    const alertsByStructure = await this.prisma.alert.groupBy({
      by: ['healthStructureId'],
      _count: { id: true },
    });

    const structureIds = alertsByStructure.map((a) => a.healthStructureId);

    // Early return si aucune alerte : pas de structure à résoudre.
    if (structureIds.length === 0) {
      return donorsByCity.map((d) => ({
        region: d.city ?? 'Non spécifiée',
        demandLevel: 0,
        donorsCount: d._count.city,
      }));
    }

    const structures = await this.prisma.healthStructure.findMany({
      where: { id: { in: structureIds } },
      select: { id: true, region: true },
    });

    const structuresWithRegion = structures.filter(
      (s): s is { id: string; region: string } => s.region !== null,
    );

    const alertsByRegionMap: Record<string, number> = {};
    alertsByStructure.forEach((alertGroup) => {
      const structure = structuresWithRegion.find(
        (s) => s.id === alertGroup.healthStructureId,
      );
      if (structure) {
        const region = structure.region;
        alertsByRegionMap[region] =
          (alertsByRegionMap[region] ?? 0) + alertGroup._count.id;
      }
    });

    const allRegions = new Set<string>([
      ...donorsByCity.map((d) => d.city).filter((c): c is string => c !== null),
      ...Object.keys(alertsByRegionMap),
    ]);

    const maxAlerts = Math.max(...Object.values(alertsByRegionMap), 1);

    const data = Array.from(allRegions).map((region) => {
      const donorData = donorsByCity.find((d) => d.city === region);
      const donorsCount = donorData?._count.city ?? 0;
      const demandCount = alertsByRegionMap[region] ?? 0;
      const demandLevel = Math.round((demandCount / maxAlerts) * 100);

      return { region, demandLevel, donorsCount };
    });

    return data.sort((a, b) => b.demandLevel - a.demandLevel);
  }

  async ensureStockInitialized(cntsId: string): Promise<void> {
    for (const bloodType of ALL_BLOOD_TYPES) {
      await this.prisma.bloodStock.upsert({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: cntsId,
            bloodType,
          },
        },
        create: {
          healthStructureId: cntsId,
          bloodType,
          quantity: 0,
          level: BloodStockLevel.ADEQUATE,
        },
        update: {},
      });
    }
  }
}

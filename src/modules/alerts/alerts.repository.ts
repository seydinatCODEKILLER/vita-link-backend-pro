import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertStatus, BloodType } from '@/generated/prisma/enums';

const ALERT_SUMMARY_SELECT = {
  id: true,
  bloodType: true,
  quantityNeeded: true,
  quantityConfirmed: true,
  urgencyLevel: true,
  status: true,
  origin: true,
  bloodRequestId: true,
  serviceUnit: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusKm: true,
  expiresAt: true,
  createdAt: true,
  healthStructure: {
    select: {
      id: true,
      name: true,
      structureType: true,
      address: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

const ALERT_DETAIL_SELECT = {
  ...ALERT_SUMMARY_SELECT,
  closedAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  _count: { select: { alertResponses: true } },
} as const;

const RESPONSE_SELECT = {
  id: true,
  status: true,
  etaMinutes: true,
  respondedAt: true,
  arrivedAt: true,
  donor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bloodType: true,
      avatarUrl: true,
      phone: true,
    },
  },
} as const;

export interface NearbyDonorRow {
  id: string;
  firstName: string;
  lastName: string;
  expoPushToken: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
}

export interface NearbyAlertRow {
  id: string;
  bloodType: string;
  quantityNeeded: number;
  quantityConfirmed: number;
  urgencyLevel: string;
  status: string;
  serviceUnit: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusKm: number;
  expiresAt: Date | null;
  createdAt: Date;
  structureId: string;
  structureName: string;
  structureAddress: string;
  structureLatitude: number;
  structureLongitude: number;
  distance_km: number;
}

export type AlertDetail = NonNullable<
  Awaited<ReturnType<AlertsRepository['findByIdWithDetails']>>
>;

@Injectable()
export class AlertsRepository extends BaseRepository<PrismaService['alert']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.alert);
  }

  createAlert(data: Parameters<PrismaService['alert']['create']>[0]['data']) {
    return this.model.create({ data, select: ALERT_DETAIL_SELECT });
  }

  findByIdWithDetails(id: string) {
    return this.model.findUnique({
      where: { id },
      select: ALERT_DETAIL_SELECT,
    });
  }

  findNearbyActive(
    latitude: number,
    longitude: number,
    radiusKm: number,
    userId: string,
  ) {
    return this.prisma.$queryRaw<NearbyAlertRow[]>`
      SELECT
        a.id,
        a."bloodType",
        a."quantityNeeded",
        a."quantityConfirmed",
        a."urgencyLevel",
        a.status,
        a."serviceUnit",
        a.address,
        a.latitude,
        a.longitude,
        a."radiusKm",
        a."expiresAt",
        a."createdAt",
        hs.id            AS "structureId",
        hs.name          AS "structureName",
        hs.address       AS "structureAddress",
        hs.latitude      AS "structureLatitude",
        hs.longitude     AS "structureLongitude",
        (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${latitude})) * cos(radians(a.latitude)) *
              cos(radians(a.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) * sin(radians(a.latitude))
            )
          )
        ) AS distance_km
      FROM alerts a
      JOIN health_structures hs ON hs.id = a."healthStructureId"
      WHERE
        a.status = 'ACTIVE'
        AND (a."expiresAt" IS NULL OR a."expiresAt" > NOW())
        AND a.latitude  IS NOT NULL
        AND a.longitude IS NOT NULL
        AND (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${latitude})) * cos(radians(a.latitude)) *
              cos(radians(a.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) * sin(radians(a.latitude))
            )
          )
        ) <= LEAST(a."radiusKm", ${radiusKm})
        AND NOT EXISTS (
          SELECT 1 FROM alert_responses ar
          WHERE ar."alertId" = a.id
            AND ar."donorId" = ${userId}::uuid
            AND ar.status IN ('CONFIRMED', 'ARRIVED')
        )
      ORDER BY
        CASE a."urgencyLevel" WHEN 'VITAL' THEN 0 ELSE 1 END ASC,
        distance_km ASC
    `;
  }

  findNearbyDonors(
    latitude: number,
    longitude: number,
    radiusKm: number,
    bloodType: BloodType,
  ) {
    return this.prisma.$queryRaw<NearbyDonorRow[]>`
      SELECT
        u.id,
        u."firstName",
        u."lastName",
        u."expoPushToken",
        u.latitude,
        u.longitude,
        (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${latitude})) * cos(radians(u.latitude)) *
              cos(radians(u.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) * sin(radians(u.latitude))
            )
          )
        ) AS distance_km
      FROM users u
      LEFT JOIN jambars_profiles jp ON jp."userId" = u.id
      WHERE
        u.role = 'DONOR'
        AND u."isAvailable" = true
        AND u."isActive" = true
        AND (u."bloodType" = ${bloodType}::"BloodType" OR u."bloodType" IS NULL)
        AND u.latitude  IS NOT NULL
        AND u.longitude IS NOT NULL
        AND (jp."nextEligibilityAt" IS NULL OR jp."nextEligibilityAt" <= NOW())
        AND (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${latitude})) * cos(radians(u.latitude)) *
              cos(radians(u.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) * sin(radians(u.latitude))
            )
          )
        ) <= ${radiusKm}
      ORDER BY distance_km ASC
    `;
  }

  findByStructure(
    structureId: string,
    filters: { page: number; limit: number; status?: AlertStatus },
  ) {
    const where = {
      healthStructureId: structureId,
      ...(filters.status && { status: filters.status }),
    };

    return this.findManyWithCount(where, {
      page: filters.page,
      limit: filters.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        ...ALERT_SUMMARY_SELECT,
        _count: { select: { alertResponses: true } },
      },
    });
  }

  findResponses(alertId: string) {
    return this.prisma.alertResponse.findMany({
      where: { alertId },
      select: RESPONSE_SELECT,
      orderBy: [{ status: 'asc' }, { respondedAt: 'asc' }],
    });
  }

  async incrementConfirmed(alertId: string) {
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.update({
        where: { id: alertId },
        data: { quantityConfirmed: { increment: 1 } },
        select: {
          id: true,
          quantityNeeded: true,
          quantityConfirmed: true,
          status: true,
          healthStructureId: true,
        },
      });

      if (
        alert.quantityConfirmed >= alert.quantityNeeded &&
        alert.status === 'ACTIVE'
      ) {
        return tx.alert.update({
          where: { id: alertId },
          data: {
            status: 'QUOTA_REACHED',
          },
          select: {
            id: true,
            quantityNeeded: true,
            quantityConfirmed: true,
            status: true,
            healthStructureId: true,
          },
        });
      }

      return alert;
    });
  }

  async decrementConfirmed(alertId: string) {
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.update({
        where: { id: alertId },
        data: { quantityConfirmed: { decrement: 1 } },
        select: {
          id: true,
          quantityNeeded: true,
          quantityConfirmed: true,
          status: true,
          healthStructureId: true,
        },
      });

      if (
        alert.quantityConfirmed < alert.quantityNeeded &&
        alert.status === 'QUOTA_REACHED'
      ) {
        return tx.alert.update({
          where: { id: alertId },
          data: { status: 'ACTIVE' },
          select: {
            id: true,
            quantityNeeded: true,
            quantityConfirmed: true,
            status: true,
            healthStructureId: true,
          },
        });
      }

      return alert;
    });
  }

  closeAlert(alertId: string) {
    return this.model.update({
      where: { id: alertId },
      data: { status: 'CANCELLED', closedAt: new Date() },
      select: ALERT_DETAIL_SELECT,
    });
  }

  expireStaleAlerts() {
    return this.model.updateMany({
      where: { status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }
}

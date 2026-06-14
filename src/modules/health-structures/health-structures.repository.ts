import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { HealthStructureStatus, StructureType } from '@/generated/prisma/enums';

const STRUCTURE_SELECT = {
  id: true,
  name: true,
  structureType: true,
  registrationNumber: true,
  address: true,
  region: true,
  latitude: true,
  longitude: true,
  phone: true,
  email: true,
  isVerified: true,
  status: true,
  affiliatedCntsId: true,
  verifiedAt: true,
  createdAt: true,
} as const;

const STAFF_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  isStructureAdmin: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class HealthStructuresRepository extends BaseRepository<
  PrismaService['healthStructure']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.healthStructure);
  }

  // ─── Lecture ───────────────────────────────────────────────

  findAll() {
    return this.model.findMany({
      select: {
        ...STRUCTURE_SELECT,
        _count: {
          select: {
            staffMembers: true,
            alerts: true,
            donations: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findStructureById(id: string) {
    return this.model.findUnique({
      where: { id },
      select: {
        ...STRUCTURE_SELECT,
        _count: {
          select: {
            staffMembers: true,
            alerts: true,
            donations: true,
          },
        },
      },
    });
  }

  findByUserId(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        healthStructureId: true,
        isStructureAdmin: true,
        employerStructure: {
          select: {
            ...STRUCTURE_SELECT,
            affiliatedCnts: {
              select: { id: true, name: true, phone: true, email: true },
            },
            _count: {
              select: {
                staffMembers: true,
                alerts: true,
                donations: true,
              },
            },
          },
        },
      },
    });
  }

  findByRegistrationNumber(registrationNumber: string) {
    return this.model.findUnique({ where: { registrationNumber } });
  }

  findValidCntsById(cntsId: string) {
    return this.model.findFirst({
      where: { id: cntsId, structureType: StructureType.CNTS },
      select: { id: true, name: true },
    });
  }

  findAvailableCnts() {
    return this.model.findMany({
      where: {
        structureType: StructureType.CNTS,
        status: HealthStructureStatus.VERIFIED,
      },
      select: { id: true, name: true, region: true, address: true },
      orderBy: { region: 'asc' },
    });
  }

  findAffiliatedHospitals(
    cntsId: string,
    filters: { status?: HealthStructureStatus } = {},
  ) {
    return this.model.findMany({
      where: {
        affiliatedCntsId: cntsId,
        structureType: {
          in: [StructureType.HOSPITAL, StructureType.HEALTH_CENTER],
        },
        ...(filters.status && { status: filters.status }),
      },
      select: {
        id: true,
        name: true,
        structureType: true,
        status: true,
        address: true,
        region: true,
        phone: true,
        email: true,
        _count: { select: { staffMembers: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  // ─── Staff ─────────────────────────────────────────────────

  findStaff(structureId: string) {
    return this.prisma.user.findMany({
      where: { healthStructureId: structureId },
      select: STAFF_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findStaffMember(userId: string, structureId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, healthStructureId: structureId },
      select: STAFF_SELECT,
    });
  }

  addStaff(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
    role: string;
    isActive: boolean;
    healthStructureId: string;
    isStructureAdmin: boolean;
  }) {
    return this.prisma.user.create({
      data: data as Parameters<PrismaService['user']['create']>[0]['data'],
      select: STAFF_SELECT,
    });
  }

  removeStaff(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { healthStructureId: null, isStructureAdmin: false },
      select: { id: true },
    });
  }

  // ─── Mutations ─────────────────────────────────────────────

  updateStructure(structureId: string, data: object) {
    return this.model.update({
      where: { id: structureId },
      data,
      select: STRUCTURE_SELECT,
    });
  }

  // ─── Stats ─────────────────────────────────────────────────

  async getStats(structureId: string, structureType: StructureType) {
    const baseQueries = [
      this.prisma.donation.count({
        where: { healthStructureId: structureId, isDone: true },
      }),
      this.prisma.$queryRaw<{ avg_minutes: number | null }[]>`
        SELECT AVG(
          EXTRACT(EPOCH FROM (ar."arrivedAt" - a."createdAt")) / 60
        ) as avg_minutes
        FROM alert_responses ar
        JOIN alerts a ON a.id = ar."alertId"
        WHERE a."healthStructureId" = ${structureId}::uuid
          AND ar."arrivedAt" IS NOT NULL
      `,
      this.prisma.alert.groupBy({
        by: ['status'],
        where: { healthStructureId: structureId },
        _count: { status: true },
      }),
    ] as const;

    if (structureType === StructureType.CNTS) {
      const [totalDonations, avgResponseTime, alertStats, bloodStocks] =
        await Promise.all([
          ...baseQueries,
          this.prisma.bloodStock.findMany({
            where: { healthStructureId: structureId },
            select: {
              bloodType: true,
              quantity: true,
              level: true,
              lastSuppliedAt: true,
            },
          }),
        ]);

      return this._buildStats(
        totalDonations,
        avgResponseTime,
        alertStats,
        bloodStocks,
      );
    }

    const [totalDonations, avgResponseTime, alertStats] =
      await Promise.all(baseQueries);

    return this._buildStats(totalDonations, avgResponseTime, alertStats);
  }

  private _buildStats(
    totalDonations: number,
    avgResponseTime: { avg_minutes: number | null }[],
    alertStats: { status: string; _count: { status: number } }[],
    bloodStocks?: unknown[],
  ) {
    const avgMinutes = avgResponseTime[0]?.avg_minutes
      ? Math.round(Number(avgResponseTime[0].avg_minutes))
      : null;

    const alertsByStatus = alertStats.reduce<Record<string, number>>(
      (acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      },
      {},
    );

    return {
      totalDonations,
      avgResponseTimeMinutes: avgMinutes,
      alerts: alertsByStatus,
      ...(bloodStocks !== undefined && { bloodStocks }),
    };
  }

  // ─── Transactions ──────────────────────────────────────────

  async createCntsWithDirector(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
    structureName: string;
    registrationNumber: string;
    address: string;
    region: string;
    structurePhone?: string;
    structureEmail?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.healthStructure.create({
        data: {
          name: data.structureName,
          registrationNumber: data.registrationNumber,
          address: data.address,
          region: data.region,
          phone: data.structurePhone,
          email: data.structureEmail,
          latitude: data.latitude,
          longitude: data.longitude,
          structureType: StructureType.CNTS,
          affiliatedCntsId: null,
          status: HealthStructureStatus.PENDING_REVIEW,
          isVerified: false,
        },
      });

      const director = await tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          passwordHash: data.passwordHash,
          role: 'CNTS_ADMIN',
          isActive: true,
          healthStructureId: structure.id,
          isStructureAdmin: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isStructureAdmin: true,
          healthStructureId: true,
        },
      });

      const bloodTypes = [
        'A_POS',
        'A_NEG',
        'B_POS',
        'B_NEG',
        'AB_POS',
        'AB_NEG',
        'O_POS',
        'O_NEG',
      ] as const;

      await tx.bloodStock.createMany({
        data: bloodTypes.map((bloodType) => ({
          healthStructureId: structure.id,
          bloodType,
          quantity: 0,
          level: 'ADEQUATE' as const,
        })),
      });

      return { structure, director };
    });
  }

  async createHospitalWithDirector(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
    structureName: string;
    registrationNumber: string;
    address: string;
    region: string;
    structureType: StructureType;
    affiliatedCntsId: string;
    structurePhone?: string;
    structureEmail?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const structure = await tx.healthStructure.create({
        data: {
          name: data.structureName,
          registrationNumber: data.registrationNumber,
          address: data.address,
          region: data.region,
          phone: data.structurePhone,
          email: data.structureEmail,
          latitude: data.latitude,
          longitude: data.longitude,
          structureType: data.structureType,
          affiliatedCntsId: data.affiliatedCntsId,
          status: HealthStructureStatus.PENDING_REVIEW,
          isVerified: false,
        },
      });

      const director = await tx.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          passwordHash: data.passwordHash,
          role: 'HOSPITAL_AGENT',
          isActive: true,
          healthStructureId: structure.id,
          isStructureAdmin: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isStructureAdmin: true,
          healthStructureId: true,
        },
      });

      return { structure, director };
    });
  }
}

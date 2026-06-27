import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BloodRequestStatus,
  BloodStockLevel,
  BloodType,
} from '@/generated/prisma/enums';

const BLOOD_REQUEST_SELECT = {
  id: true,
  bloodType: true,
  quantityNeeded: true,
  quantityProvided: true,
  urgencyLevel: true,
  serviceUnit: true,
  clinicalContext: true,
  status: true,
  cntsNotes: true,
  escalatedAlertId: true,
  fulfilledAt: true,
  createdAt: true,
  updatedAt: true,
  requestingHospital: {
    select: { id: true, name: true, address: true, region: true },
  },
  requestedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  handledByCnts: {
    select: { id: true, name: true, region: true },
  },
  handledBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  escalatedAlert: {
    select: { id: true, status: true, createdAt: true },
  },
  purchaseOrder: {
    select: {
      id: true,
      code: true,
      bloodType: true,
      quantity: true,
      status: true,
      expiresAt: true,
      scannedAt: true,
      cnts: { select: { id: true, name: true, address: true } },
    },
  },
} as const;

@Injectable()
export class BloodRequestsRepository extends BaseRepository<
  PrismaService['bloodRequest']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.bloodRequest);
  }

  createRequest(
    data: Parameters<PrismaService['bloodRequest']['create']>[0]['data'],
  ) {
    return this.model.create({ data, select: BLOOD_REQUEST_SELECT });
  }

  findRequestById(id: string) {
    return this.model.findUnique({
      where: { id },
      select: BLOOD_REQUEST_SELECT,
    });
  }

  findHospitalStructureById(hospitalId: string) {
    return this.prisma.healthStructure.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        structureType: true,
        affiliatedCntsId: true,
        isVerified: true,
        address: true,
        latitude: true,
        longitude: true,
      },
    });
  }

  findStockByCntsAndType(cntsId: string, bloodType: BloodType) {
    return this.prisma.bloodStock.findUnique({
      where: {
        healthStructureId_bloodType: {
          healthStructureId: cntsId,
          bloodType,
        },
      },
    });
  }

  decrementStock(stockId: string, quantity: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.bloodStock.findUnique({
        where: { id: stockId },
        select: { quantity: true },
      });

      if (!current) throw new Error('Stock introuvable');
      if (current.quantity < quantity) {
        throw new Error(
          `Stock insuffisant. Actuel: ${current.quantity}, Demandé: ${quantity}`,
        );
      }

      const newQty = current.quantity - quantity;
      const level =
        newQty === 0
          ? BloodStockLevel.CRITICAL
          : newQty <= 5
            ? BloodStockLevel.LOW
            : newQty <= 15
              ? BloodStockLevel.ADEQUATE
              : BloodStockLevel.SURPLUS;

      return tx.bloodStock.update({
        where: { id: stockId },
        data: {
          quantity: newQty,
          level: level,
        },
      });
    });
  }

  findByHospital(
    hospitalId: string,
    filters: { page: number; limit: number; status?: BloodRequestStatus },
  ) {
    return this.findManyWithCount(
      {
        requestingHospitalId: hospitalId,
        ...(filters.status && { status: filters.status }),
      },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { createdAt: 'desc' },
        select: BLOOD_REQUEST_SELECT,
      },
    );
  }

  findByCnts(
    cntsId: string,
    filters: { page: number; limit: number; status?: BloodRequestStatus },
  ) {
    return this.findManyWithCount(
      {
        handledByCntsId: cntsId,
        ...(filters.status && { status: filters.status }),
      },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { createdAt: 'desc' },
        select: BLOOD_REQUEST_SELECT,
      },
    );
  }

  updateStatus(
    id: string,
    data: {
      status: BloodRequestStatus;
      quantityProvided?: number;
      handledByUserId?: string;
      cntsNotes?: string | null;
      fulfilledAt?: Date;
      escalatedAlertId?: string;
    },
  ) {
    return this.model.update({
      where: { id },
      data,
      select: BLOOD_REQUEST_SELECT,
    });
  }
}

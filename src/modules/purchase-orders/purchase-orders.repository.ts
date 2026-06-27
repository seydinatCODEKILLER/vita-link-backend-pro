import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { PurchaseOrderStatus, BloodType } from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';

const PURCHASE_ORDER_SELECT = {
  id: true,
  code: true,
  bloodType: true,
  quantity: true,
  status: true,
  expiresAt: true,
  scannedAt: true,
  createdAt: true,
  updatedAt: true,
  bloodRequest: {
    select: { id: true, urgencyLevel: true, serviceUnit: true },
  },
  cnts: {
    select: { id: true, name: true, address: true },
  },
  hospital: {
    select: { id: true, name: true, address: true },
  },
  scannedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export type PurchaseOrderDetail = Prisma.PurchaseOrderGetPayload<{
  select: typeof PURCHASE_ORDER_SELECT;
}>;

@Injectable()
export class PurchaseOrdersRepository extends BaseRepository<
  PrismaService['purchaseOrder']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.purchaseOrder);
  }

  createOrder(data: {
    code: string;
    bloodRequestId: string;
    cntsId: string;
    hospitalId: string;
    bloodType: BloodType;
    quantity: number;
    expiresAt: Date;
  }): Promise<PurchaseOrderDetail> {
    return this.model.create({
      data,
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findOrderById(id: string): Promise<PurchaseOrderDetail | null> {
    return this.model.findUnique({
      where: { id },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findByCode(code: string): Promise<PurchaseOrderDetail | null> {
    return this.model.findUnique({
      where: { code },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findByBloodRequest(
    bloodRequestId: string,
  ): Promise<PurchaseOrderDetail | null> {
    return this.model.findUnique({
      where: { bloodRequestId },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  findByCnts(
    cntsId: string,
    filters: { page: number; limit: number; status?: PurchaseOrderStatus },
  ) {
    return this.findManyWithCount<PurchaseOrderDetail>(
      { cntsId, ...(filters.status && { status: filters.status }) },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { createdAt: 'desc' },
        select: PURCHASE_ORDER_SELECT,
      },
    );
  }

  findByHospital(
    hospitalId: string,
    filters: { page: number; limit: number; status?: PurchaseOrderStatus },
  ) {
    return this.findManyWithCount<PurchaseOrderDetail>(
      { hospitalId, ...(filters.status && { status: filters.status }) },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { createdAt: 'desc' },
        select: PURCHASE_ORDER_SELECT,
      },
    );
  }

  markAsUsed(
    id: string,
    scannedByUserId: string,
  ): Promise<PurchaseOrderDetail> {
    return this.model.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.USED,
        scannedByUserId,
        scannedAt: new Date(),
      },
      select: PURCHASE_ORDER_SELECT,
    });
  }

  expireStaleOrders() {
    return this.model.updateMany({
      where: {
        status: PurchaseOrderStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: PurchaseOrderStatus.EXPIRED },
    });
  }

  async confirmExpiry(
    id: string,
    wasDelivered: boolean,
    cntsNotes: string | undefined,
    scannedByUserId: string,
  ): Promise<PurchaseOrderDetail> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: wasDelivered
            ? PurchaseOrderStatus.USED
            : PurchaseOrderStatus.CANCELLED,
          cntsNotes: cntsNotes ?? null,
          scannedByUserId: wasDelivered ? scannedByUserId : null,
          scannedAt: wasDelivered ? new Date() : null,
        },
        select: PURCHASE_ORDER_SELECT,
      });

      if (!wasDelivered) {
        await tx.bloodStock.update({
          where: {
            healthStructureId_bloodType: {
              healthStructureId: order.cnts.id,
              bloodType: order.bloodType,
            },
          },
          data: { quantity: { increment: order.quantity } },
        });
      }

      return order as PurchaseOrderDetail;
    });
  }
}

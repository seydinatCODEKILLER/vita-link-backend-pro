import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertResponseStatus, AlertStatus } from '@/generated/prisma/enums';

@Injectable()
export class AlertResponsesRepository extends BaseRepository<
  PrismaService['alertResponse']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.alertResponse);
  }

  // ─── Lecture ───────────────────────────────────────────────

  findByAlertAndDonor(alertId: string, donorId: string) {
    return this.model.findUnique({
      where: { alertId_donorId: { alertId, donorId } },
    });
  }

  findActiveAlert(alertId: string) {
    return this.prisma.alert.findFirst({
      where: {
        id: alertId,
        status: AlertStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });
  }

  findActiveConfirmationsForDonor(donorId: string) {
    return this.model.findMany({
      where: { donorId, status: AlertResponseStatus.CONFIRMED },
    });
  }

  findDonorProfile(userId: string) {
    return this.prisma.jambaarsProfile.findUnique({ where: { userId } });
  }

  // ─── Mutations AlertResponse ───────────────────────────────

  createResponse(data: {
    alertId: string;
    donorId: string;
    status: AlertResponseStatus;
    etaMinutes?: number | null;
    qrCode: string;
  }) {
    return this.model.create({ data });
  }

  updateResponseStatus(
    id: string,
    data: {
      status: AlertResponseStatus;
      arrivedAt?: Date;
      etaMinutes?: number;
    },
  ) {
    return this.model.update({ where: { id }, data });
  }

  upsertDecline(alertId: string, donorId: string) {
    return this.model.upsert({
      where: { alertId_donorId: { alertId, donorId } },
      create: { alertId, donorId, status: AlertResponseStatus.DECLINED },
      update: { status: AlertResponseStatus.DECLINED },
    });
  }

  // ─── Mutations Alert ───────────────────────────────────────

  incrementAlertConfirmed(alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { quantityConfirmed: { increment: 1 } },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });
  }

  decrementAlertConfirmed(alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { quantityConfirmed: { decrement: 1 } },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });
  }

  closeAlert(alertId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { status: AlertStatus.QUOTA_REACHED, closedAt: new Date() },
    });
  }

  async reopenAlertIfNecessary(alertId: string): Promise<boolean> {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      select: {
        id: true,
        quantityNeeded: true,
        quantityConfirmed: true,
        status: true,
      },
    });

    if (
      alert?.status === AlertStatus.QUOTA_REACHED &&
      alert.quantityConfirmed < alert.quantityNeeded
    ) {
      await this.prisma.alert.update({
        where: { id: alertId },
        data: { status: AlertStatus.ACTIVE, closedAt: null },
      });
      return true;
    }

    return false;
  }

  // ─── Mutations JambaarsProfile ─────────────────────────────

  incrementNoShowCount(userId: string) {
    return this.prisma.jambaarsProfile.update({
      where: { userId },
      data: { noShowCount: { increment: 1 } },
    });
  }
}

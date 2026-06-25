import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { DonorGrade, BloodType } from '@/generated/prisma/enums';
import { Prisma } from '@/generated/prisma/client';

const DONATION_SUMMARY_SELECT = {
  id: true,
  isDone: true,
  pointsAwarded: true,
  donatedAt: true,
  validatedAt: true,
  notes: true,
  healthStructure: { select: { id: true, name: true } },
  alertResponse: {
    select: {
      qrCode: true,
      etaMinutes: true,
      alert: {
        select: {
          id: true,
          bloodType: true,
          urgencyLevel: true,
          serviceUnit: true,
          healthStructure: { select: { id: true, name: true, address: true } },
        },
      },
    },
  },
} as const;

const DONATION_DETAIL_SELECT = {
  ...DONATION_SUMMARY_SELECT,
  testResultsJson: true,
  donor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bloodType: true,
      avatarUrl: true,
      phone: true,
      // Inclus pour permettre au service de renvoyer le profil Jambaar à
      // jour dans l'event socket `donation:validated`. Attention : au
      // moment de `tx.donation.create(...)` dans validateDonation(),
      // l'upsert de jambaarsProfile n'a pas encore eu lieu — ce select
      // renverrait donc l'état AVANT crédit des points. Le profil à jour
      // est réinjecté manuellement après coup, voir validateDonation().
      jambaarsProfile: {
        select: {
          id: true,
          totalPoints: true,
          currentGrade: true,
          donationCount: true,
          livesSavedEstimate: true,
          nextEligibilityAt: true,
        },
      },
    },
  },
  validatedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

export type DonationSummary = Prisma.DonationGetPayload<{
  select: typeof DONATION_SUMMARY_SELECT;
}>;

export type DonationDetail = Prisma.DonationGetPayload<{
  select: typeof DONATION_DETAIL_SELECT;
}>;

@Injectable()
export class DonationsRepository extends BaseRepository<
  PrismaService['donation']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.donation);
  }

  findAlertResponseByQrCode(qrCode: string) {
    return this.prisma.alertResponse.findFirst({
      where: { qrCode },
      select: {
        id: true,
        alertId: true,
        donorId: true,
        status: true,
        etaMinutes: true,
        respondedAt: true,
        donation: { select: { id: true } },
        alert: {
          select: {
            id: true,
            bloodType: true,
            urgencyLevel: true,
            healthStructureId: true,
          },
        },
        donor: {
          select: {
            id: true,
            gender: true,
            jambaarsProfile: {
              select: {
                id: true,
                totalPoints: true,
                currentGrade: true,
                donationCount: true,
              },
            },
          },
        },
      },
    });
  }

  findUserPushToken(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true, firstName: true },
    });
  }

  findStructureById(structureId: string) {
    return this.prisma.healthStructure.findUnique({
      where: { id: structureId },
      select: { id: true, affiliatedCntsId: true, structureType: true },
    });
  }

  async validateDonation(params: {
    alertResponseId: string;
    donorId: string;
    healthStructureId: string;
    stockStructureId: string;
    validatedByUserId: string;
    bloodType: BloodType;
    pointsAwarded: number;
    newGrade: DonorGrade;
    nextEligibilityAt: Date;
    notes?: string;
    testResultsJson?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const donation = await tx.donation.create({
        data: {
          donorId: params.donorId,
          alertResponseId: params.alertResponseId,
          healthStructureId: params.healthStructureId,
          validatedByUserId: params.validatedByUserId,
          isDone: true,
          pointsAwarded: params.pointsAwarded,
          notes: params.notes,
          testResultsJson: params.testResultsJson,
          donatedAt: new Date(),
          validatedAt: new Date(),
        },
        select: DONATION_DETAIL_SELECT,
      });

      await tx.alertResponse.update({
        where: { id: params.alertResponseId },
        data: { status: 'ARRIVED', arrivedAt: new Date() },
      });

      const updatedProfile = await tx.jambaarsProfile.upsert({
        where: { userId: params.donorId },
        update: {
          totalPoints: { increment: params.pointsAwarded },
          donationCount: { increment: 1 },
          currentGrade: params.newGrade,
          lastDonationAt: new Date(),
          nextEligibilityAt: params.nextEligibilityAt,
          livesSavedEstimate: { increment: 3 },
        },
        create: {
          userId: params.donorId,
          totalPoints: params.pointsAwarded,
          donationCount: 1,
          currentGrade: params.newGrade,
          lastDonationAt: new Date(),
          nextEligibilityAt: params.nextEligibilityAt,
          livesSavedEstimate: 3,
        },
        select: {
          id: true,
          totalPoints: true,
          currentGrade: true,
          donationCount: true,
          livesSavedEstimate: true,
          nextEligibilityAt: true,
        },
      });

      await tx.bloodStock.upsert({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: params.stockStructureId,
            bloodType: params.bloodType,
          },
        },
        create: {
          healthStructureId: params.stockStructureId,
          bloodType: params.bloodType,
          quantity: 1,
          level: 'ADEQUATE',
        },
        update: { quantity: { increment: 1 } },
      });

      return {
        ...donation,
        donor: {
          ...donation.donor,
          jambaarsProfile: updatedProfile,
        },
      };
    });
  }

  findDonationById(id: string) {
    return this.model.findUnique({
      where: { id },
      select: DONATION_DETAIL_SELECT,
    }) as Promise<DonationDetail | null>;
  }

  findMyDonations(donorId: string, filters: { page: number; limit: number }) {
    return this.findManyWithCount<DonationSummary>(
      { donorId, isDone: true },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { donatedAt: 'desc' },
        select: DONATION_SUMMARY_SELECT,
      },
    );
  }

  findStructureDonations(
    healthStructureId: string,
    filters: { page: number; limit: number },
  ) {
    return this.findManyWithCount<DonationDetail>(
      { healthStructureId, isDone: true },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { donatedAt: 'desc' },
        select: DONATION_DETAIL_SELECT,
      },
    );
  }
}

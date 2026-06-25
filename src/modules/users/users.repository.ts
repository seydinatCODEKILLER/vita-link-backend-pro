import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';

const ME_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  gender: true,
  dateOfBirth: true,
  avatarUrl: true,
  bloodType: true,
  isAvailable: true,
  isActive: true,
  latitude: true,
  longitude: true,
  healthStructureId: true,
  isStructureAdmin: true,
  createdAt: true,
  jambaarsProfile: {
    select: {
      totalPoints: true,
      currentGrade: true,
      donationCount: true,
      livesSavedEstimate: true,
      lastDonationAt: true,
      nextEligibilityAt: true,
      city: true,
      district: true,
    },
  },
  employerStructure: {
    select: {
      id: true,
      name: true,
      status: true,
      isVerified: true,
      address: true,
      structureType: true,
      affiliatedCntsId: true,
      affiliatedCnts: {
        select: { id: true, name: true, phone: true },
      },
    },
  },
} as const;

@Injectable()
export class UsersRepository extends BaseRepository<PrismaService['user']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.user);
  }

  findMe(userId: string) {
    return this.model.findUnique({
      where: { id: userId },
      select: ME_SELECT,
    });
  }

  updateProfile(userId: string, data: object) {
    return this.model.update({
      where: { id: userId },
      data,
      select: ME_SELECT,
    });
  }

  updateAvatar(userId: string, avatarUrl: string) {
    return this.model.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  updateLocation(userId: string, latitude: number, longitude: number) {
    return this.model.update({
      where: { id: userId },
      data: { latitude, longitude },
      select: { id: true, latitude: true, longitude: true },
    });
  }

  updateAvailability(userId: string, isAvailable: boolean) {
    return this.model.update({
      where: { id: userId },
      data: { isAvailable },
      select: { id: true, isAvailable: true },
    });
  }

  updateExpoToken(userId: string, expoPushToken: string) {
    return this.model.update({
      where: { id: userId },
      data: { expoPushToken },
      select: { id: true, expoPushToken: true },
    });
  }

  softDelete(userId: string) {
    return this.model.update({
      where: { id: userId },
      data: {
        email: null,
        phone: `DELETED_${userId}`,
        firstName: 'Compte',
        lastName: 'Supprimé',
        avatarUrl: null,
        dateOfBirth: null,
        isActive: false,
        isAvailable: false,
        expoPushToken: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        latitude: null,
        longitude: null,
      },
      select: { id: true },
    });
  }

  findActiveEngagement(donorId: string) {
    return this.prisma.alertResponse.findFirst({
      where: {
        donorId,
        status: 'CONFIRMED',
        alert: {
          status: { in: ['ACTIVE', 'QUOTA_REACHED'] },
        },
      },
      select: {
        id: true,
        qrCode: true,
        etaMinutes: true,
        alert: {
          select: {
            id: true,
            bloodType: true,
            urgencyLevel: true,
            status: true,
            origin: true,
            healthStructure: {
              select: { id: true, name: true, address: true },
            },
          },
        },
      },
    });
  }
}

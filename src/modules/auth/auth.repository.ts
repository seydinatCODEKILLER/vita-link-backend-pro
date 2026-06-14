import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { User } from '@/generated/prisma/client';

const DONOR_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  bloodType: true,
  gender: true,
  isActive: true,
  isAvailable: true,
  jambaarsProfile: {
    select: {
      totalPoints: true,
      currentGrade: true,
      donationCount: true,
    },
  },
} as const;

@Injectable()
export class AuthRepository extends BaseRepository<PrismaService['user']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.user);
  }

  findByEmail(email: string) {
    return this.model.findUnique({ where: { email } });
  }

  findByPhone(phone: string) {
    return this.model.findUnique({ where: { phone } });
  }

  findByRefreshToken(token: string) {
    return this.model.findUnique({ where: { refreshToken: token } });
  }

  findByEmailWithRole(email: string) {
    return this.model.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        firstName: true,
      },
    });
  }

  findDonorByEmail(email: string) {
    return this.model.findUnique({
      where: { email },
      select: DONOR_SELECT,
    });
  }

  storeRefreshToken(userId: string, refreshToken: string, expiresAt: Date) {
    return this.model.update({
      where: { id: userId },
      data: { refreshToken, refreshTokenExpiresAt: expiresAt },
    });
  }

  revokeRefreshToken(userId: string) {
    return this.model.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenExpiresAt: null },
    });
  }

  createDonor(data: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    bloodType?: string;
    gender: string;
    dateOfBirth?: string;
  }) {
    return this.model.create({
      data: {
        email: data.email,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        bloodType: data.bloodType as User['bloodType'],
        gender: data.gender as User['gender'],
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        role: 'DONOR',
        isActive: true,
        isAvailable: true,
        jambaarsProfile: {
          create: {
            totalPoints: 0,
            currentGrade: 'ASPIRANT',
            donationCount: 0,
          },
        },
      },
      select: DONOR_SELECT,
    });
  }
}

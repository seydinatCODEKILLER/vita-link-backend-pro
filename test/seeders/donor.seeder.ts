import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

export interface SeedDonorOptions {
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  bloodType?: string;
  gender?: 'MALE' | 'FEMALE';
  latitude?: number;
  longitude?: number;
  expoPushToken?: string | null;
}

export async function seedVerifiedDonor(
  app: INestApplication,
  prisma: PrismaService,
  opts: SeedDonorOptions = {},
) {
  const phone =
    opts.phone ?? `+2217${Math.floor(10000000 + Math.random() * 89999999)}`;
  const email = opts.email ?? `donor-${Date.now()}-${Math.random()}@test.sn`;

  await request(app.getHttpServer() as Express)
    .post('/auth/register/donor')
    .send({
      firstName: opts.firstName ?? 'Aliou',
      lastName: opts.lastName ?? 'Diallo',
      phone,
      email,
      bloodType: opts.bloodType ?? 'O_NEG',
      gender: opts.gender ?? 'MALE',
    })
    .expect(200);

  const otp = await prisma.otpCode.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  const res = await request(app.getHttpServer() as Express)
    .post('/auth/otp/verify')
    .send({ email, code: otp!.code })
    .expect(200);

  const donor = res.body.user;

  if (
    opts.latitude !== undefined ||
    opts.longitude !== undefined ||
    opts.expoPushToken !== undefined
  ) {
    await prisma.user.update({
      where: { id: donor.id },
      data: {
        ...(opts.latitude !== undefined && { latitude: opts.latitude }),
        ...(opts.longitude !== undefined && { longitude: opts.longitude }),
        ...(opts.expoPushToken !== undefined && {
          expoPushToken: opts.expoPushToken,
        }),
      },
    });
  }

  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    user: donor,
  };
}

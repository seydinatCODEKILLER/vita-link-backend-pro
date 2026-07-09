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
}

/**
 * Inscrit un donneur via /auth/register/donor + /auth/otp/verify.
 * Passe par les vrais endpoints (pas d'insertion Prisma directe) pour
 * garder le pipeline d'inscription/OTP honnête dans les tests d'autres
 * modules qui dépendent d'un donneur déjà authentifié.
 */
export async function seedVerifiedDonor(
  app: INestApplication,
  prisma: PrismaService,
  opts: SeedDonorOptions = {},
) {
  const phone =
    opts.phone ?? `+2217${Math.floor(10000000 + Math.random() * 89999999)}`;
  const email = opts.email ?? `donor-${Date.now()}@test.sn`;

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

  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    user: res.body.user,
  };
}

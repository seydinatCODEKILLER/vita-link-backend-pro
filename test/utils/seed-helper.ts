// test/utils/seed-helper.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@/prisma/prisma.service';
import { Express } from 'express'; // <-- AJOUT DE L'IMPORT

interface SeedDonorOptions {
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  bloodType?: string;
  gender?: 'MALE' | 'FEMALE';
}

/**
 * Inscrit un donneur via /auth/register/donor + /auth/verify-otp,
 * et retourne les tokens + l'utilisateur créé.
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
    .expect(201);

  const otp = await prisma.otpCode.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  const res = await request(app.getHttpServer() as Express)
    .post('/auth/verify-otp')
    .send({ email, code: otp!.code })
    .expect(200);

  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    user: res.body.user,
  };
}

interface SeedCntsAgentOptions {
  email?: string;
  phone?: string;
  password?: string;
  structureName?: string;
  registrationNumber?: string;
}

/**
 * Inscrit une CNTS + son directeur, puis connecte ce directeur.
 * Retourne les tokens, l'utilisateur, et l'id de la structure créée
 * (utile pour seed des BloodStock, Alert, etc. dans d'autres modules).
 */
export async function seedCntsDirector(
  app: INestApplication,
  opts: SeedCntsAgentOptions = {},
) {
  const email = opts.email ?? `cnts-${Date.now()}@test.sn`;
  const password = opts.password ?? 'CntsSecure2024!';
  const registrationNumber = opts.registrationNumber ?? `CNTS-${Date.now()}`;

  const registerRes = await request(app.getHttpServer() as Express)
    .post('/auth/register/cnts')
    .send({
      firstName: 'Dr. Aminata',
      lastName: 'Diop',
      email,
      phone:
        opts.phone ?? `+2213${Math.floor(10000000 + Math.random() * 89999999)}`,
      password,
      structureName: opts.structureName ?? 'CNTS Test',
      registrationNumber,
      address: 'Avenue Blaise Diagne, Dakar',
      region: 'Dakar',
    })
    .expect(201);

  const loginRes = await request(app.getHttpServer() as Express)
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    accessToken: loginRes.body.accessToken as string,
    refreshToken: loginRes.body.refreshToken as string,
    user: loginRes.body.user,
    structureId: registerRes.body.structure.id as string,
  };
}

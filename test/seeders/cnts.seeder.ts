import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

export const DEFAULT_LAT = 14.6928;
export const DEFAULT_LNG = -17.4467;

export interface SeedCntsOptions {
  email?: string;
  phone?: string;
  password?: string;
  structureName?: string;
  registrationNumber?: string;
}

/**
 * Inscrit une CNTS + son directeur, connecte ce directeur.
 * La structure N'EST PAS marquée vérifiée — usage brut équivalent au
 * vrai flux d'inscription (une CNTS commence non vérifiée).
 */
export async function seedCntsDirector(
  app: INestApplication,
  opts: SeedCntsOptions = {},
) {
  const email = opts.email ?? `cnts-${Date.now()}-${Math.random()}@test.sn`;
  const password = opts.password ?? 'CntsSecure2024!';
  const registrationNumber =
    opts.registrationNumber ??
    `CNTS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

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

/**
 * Comme seedCntsDirector, mais marque en plus la structure comme vérifiée
 * avec des coordonnées GPS valides. Requis pour tout scénario qui
 * déclenche AlertsService.createAlert (validateStructure exige
 * isVerified: true + coordonnées).
 */
export async function seedVerifiedCntsDirector(
  app: INestApplication,
  prisma: PrismaService,
  opts: SeedCntsOptions = {},
) {
  const result = await seedCntsDirector(app, opts);

  await prisma.healthStructure.update({
    where: { id: result.structureId },
    data: {
      isVerified: true,
      latitude: DEFAULT_LAT,
      longitude: DEFAULT_LNG,
    },
  });

  return result;
}

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

export interface SeedHospitalOptions {
  email?: string;
  phone?: string;
  password?: string;
  structureName?: string;
  registrationNumber?: string;
  affiliatedCntsId: string;
}

export async function seedHospitalAgent(
  app: INestApplication,
  opts: SeedHospitalOptions,
) {
  const email = opts.email ?? `hospital-${Date.now()}-${Math.random()}@test.sn`;
  const password = opts.password ?? 'Motdepasse123!';
  const registrationNumber =
    opts.registrationNumber ??
    `SN-MED-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const registerRes = await request(app.getHttpServer() as Express)
    .post('/auth/register/hospital')
    .send({
      firstName: 'Dr. Moussa',
      lastName: 'Sow',
      email,
      phone:
        opts.phone ?? `+2217${Math.floor(10000000 + Math.random() * 89999999)}`,
      password,
      structureName: opts.structureName ?? 'Hôpital Test',
      registrationNumber,
      address: 'Avenue Nelson Mandela, Dakar',
      region: 'Dakar',
      structureType: 'HOSPITAL',
      affiliatedCntsId: opts.affiliatedCntsId,
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
 * Comme seedHospitalAgent, mais marque en plus la structure comme
 * vérifiée. Requis pour tout scénario qui déclenche
 * AlertsService.createAlert (validateStructure exige isVerified: true).
 */
export async function seedVerifiedHospitalAgent(
  app: INestApplication,
  prisma: PrismaService,
  opts: SeedHospitalOptions,
) {
  const result = await seedHospitalAgent(app, opts);

  await prisma.healthStructure.update({
    where: { id: result.structureId },
    data: { isVerified: true },
  });

  return result;
}

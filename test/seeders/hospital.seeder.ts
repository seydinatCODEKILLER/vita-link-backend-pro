import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';

export interface SeedHospitalOptions {
  email?: string;
  phone?: string;
  password?: string;
  structureName?: string;
  registrationNumber?: string;
  affiliatedCntsId: string; // obligatoire : un hôpital doit être affilié
}

/**
 * Inscrit un hôpital affilié à une CNTS existante + son directeur,
 * connecte ce directeur.
 */
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

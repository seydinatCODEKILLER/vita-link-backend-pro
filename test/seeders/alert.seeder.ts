import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { PrismaService } from '@/prisma/prisma.service';
import { seedVerifiedCntsDirector, SeedCntsOptions } from './cnts.seeder';
import {
  seedVerifiedHospitalAgent,
  SeedHospitalOptions,
} from './hospital.seeder';

// Dakar centre-ville
export const ALERT_CENTER_LAT = 14.6928;
export const ALERT_CENTER_LNG = -17.4467;

export interface SeedActiveAlertOptions {
  quantityNeeded?: number;
  bloodType?: string;
  urgencyLevel?: 'VITAL' | 'STANDARD';
  cnts?: SeedCntsOptions;
  hospital?: Omit<SeedHospitalOptions, 'affiliatedCntsId'>;
}

/**
 * Crée une CNTS vérifiée + un hôpital affilié vérifié, puis crée une
 * alerte ACTIVE via le vrai endpoint POST /alerts. Sert de base pour
 * tous les tests du module alert-responses.
 */
export async function seedActiveAlert(
  app: INestApplication,
  prisma: PrismaService,
  opts: SeedActiveAlertOptions = {},
) {
  const cnts = await seedVerifiedCntsDirector(app, prisma, opts.cnts);
  const hospital = await seedVerifiedHospitalAgent(app, prisma, {
    ...opts.hospital,
    affiliatedCntsId: cnts.structureId,
  });

  const quantityNeeded = opts.quantityNeeded ?? 2;

  const res = await request(app.getHttpServer() as Express)
    .post('/alerts')
    .set('Authorization', `Bearer ${hospital.accessToken}`)
    .send({
      bloodType: opts.bloodType ?? 'O_NEG',
      quantityNeeded,
      urgencyLevel: opts.urgencyLevel ?? 'VITAL',
      latitude: ALERT_CENTER_LAT,
      longitude: ALERT_CENTER_LNG,
    })
    .expect(201);

  return {
    cnts,
    hospital,
    alertId: res.body.alert.id as string,
    quantityNeeded,
  };
}

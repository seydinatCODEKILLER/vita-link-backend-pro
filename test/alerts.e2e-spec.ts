// test/alerts.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db-helper';
import {
  seedVerifiedCntsDirector,
  seedVerifiedHospitalAgent,
  seedHospitalAgent,
  seedVerifiedDonor,
} from './seeders';
import { PrismaService } from '@/prisma/prisma.service';

// Dakar centre-ville — cohérent avec DEFAULT_LAT/LNG du cnts.seeder
const CENTER_LAT = 14.6928;
const CENTER_LNG = -17.4467;

// ~111km au nord — hors de portée de tout radiusKm raisonnable utilisé ici
const FAR_LAT = 15.6928;
const FAR_LNG = -17.4467;

describe('Alerts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventsServiceMock: {
    emitToUser: jest.Mock;
    emitToStructure: jest.Mock;
    emitToAlert: jest.Mock;
  };
  let pushServiceMock: { sendMulticast: jest.Mock };

  beforeAll(async () => {
    ({ app, prisma, eventsServiceMock, pushServiceMock } =
      await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================
  //  POST /alerts
  // ==========================================================
  describe('POST /alerts', () => {
    it('un hôpital vérifié crée une alerte, notifie les donneurs proches et escalade vers sa CNTS', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      // Donneur proche, groupe compatible, avec token push
      const donorWithToken = await seedVerifiedDonor(app, prisma, {
        bloodType: 'O_NEG',
        latitude: CENTER_LAT + 0.001,
        longitude: CENTER_LNG + 0.001,
        expoPushToken: 'ExponentPushToken[aaa]',
      });

      // Donneur proche, groupe compatible, sans token push
      const donorNoToken = await seedVerifiedDonor(app, prisma, {
        bloodType: 'O_NEG',
        latitude: CENTER_LAT - 0.001,
        longitude: CENTER_LNG - 0.001,
        expoPushToken: null,
      });

      // Donneur proche mais groupe sanguin incompatible — ne doit pas être notifié
      await seedVerifiedDonor(app, prisma, {
        bloodType: 'AB_POS',
        latitude: CENTER_LAT,
        longitude: CENTER_LNG,
      });

      // Donneur du bon groupe mais trop loin — ne doit pas être notifié
      await seedVerifiedDonor(app, prisma, {
        bloodType: 'O_NEG',
        latitude: FAR_LAT,
        longitude: FAR_LNG,
      });

      const res = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          radiusKm: 10,
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      expect(res.body.alert.status).toBe('ACTIVE');
      expect(res.body.notifiedDonors).toBe(2);

      // Les deux donneurs proches et compatibles sont notifiés en socket
      expect(eventsServiceMock.emitToUser).toHaveBeenCalledTimes(2);
      expect(eventsServiceMock.emitToUser).toHaveBeenCalledWith(
        donorWithToken.user.id,
        'alert:new',
        expect.objectContaining({ alertId: res.body.alert.id }),
      );
      expect(eventsServiceMock.emitToUser).toHaveBeenCalledWith(
        donorNoToken.user.id,
        'alert:new',
        expect.objectContaining({ alertId: res.body.alert.id }),
      );

      // Seul le donneur avec token reçoit une notif push
      expect(pushServiceMock.sendMulticast).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: ['ExponentPushToken[aaa]'] }),
      );

      // Escalade vers la CNTS affiliée (origin HOSPITAL_DIRECT par défaut)
      expect(eventsServiceMock.emitToStructure).toHaveBeenCalledWith(
        cnts.structureId,
        'alert:escalation',
        expect.objectContaining({ alertId: res.body.alert.id }),
      );

      const alertInDb = await prisma.alert.findUnique({
        where: { id: res.body.alert.id },
      });
      expect(alertInDb!.origin).toBe('HOSPITAL_DIRECT');
    });

    it("n'escalade pas quand l'émetteur est une CNTS", async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);

      const res = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${cnts.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      expect(res.body.alert.status).toBe('ACTIVE');
      expect(eventsServiceMock.emitToStructure).not.toHaveBeenCalledWith(
        expect.any(String),
        'alert:escalation',
        expect.any(Object),
      );
    });

    it('rejette (403) une tentative de création par un donneur', async () => {
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(403);
    });

    it("rejette (403) si la structure n'est pas vérifiée", async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      // Hôpital NON vérifié cette fois (pas de seedVerifiedHospitalAgent)
      const hospital = await seedHospitalAgent(app, {
        affiliatedCntsId: cnts.structureId,
      });

      await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(403);
    });

    it('rejette (400) si aucune coordonnée n’est disponible', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });
      // Aucune coordonnée passée dans le DTO, et la structure hôpital
      // n'a pas de coordonnées à l'inscription par défaut.

      await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
        })
        .expect(400);
    });
  });

  // ==========================================================
  //  GET /alerts (nearby, donneur uniquement)
  // ==========================================================
  describe('GET /alerts', () => {
    async function createActiveAlert(overrides: Record<string, unknown> = {}) {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const res = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          radiusKm: 15,
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
          ...overrides,
        })
        .expect(201);

      return res.body.alert.id as string;
    }

    it('un donneur voit les alertes actives à proximité', async () => {
      const alertId = await createActiveAlert();

      const donor = await seedVerifiedDonor(app, prisma, {
        latitude: CENTER_LAT,
        longitude: CENTER_LNG,
      });

      const res = await request(app.getHttpServer() as Express)
        .get('/alerts')
        .query({ lat: CENTER_LAT, lng: CENTER_LNG, radius: 15 })
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(alertId);
      expect(res.body[0].distance_km).toBeLessThan(1);
    });

    it('exclut les alertes auxquelles le donneur a déjà répondu', async () => {
      const alertId = await createActiveAlert();

      const donor = await seedVerifiedDonor(app, prisma, {
        latitude: CENTER_LAT,
        longitude: CENTER_LNG,
      });

      // Setup direct : une réponse CONFIRMED déjà enregistrée pour ce
      // donneur sur cette alerte (module alert-responses non testé ici).
      await prisma.alertResponse.create({
        data: { alertId, donorId: donor.user.id, status: 'CONFIRMED' },
      });

      const res = await request(app.getHttpServer() as Express)
        .get('/alerts')
        .query({ lat: CENTER_LAT, lng: CENTER_LNG, radius: 15 })
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('rejette (403) pour un agent hospitalier', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      await request(app.getHttpServer() as Express)
        .get('/alerts')
        .query({ lat: CENTER_LAT, lng: CENTER_LNG })
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(403);
    });

    it('rejette (400) si aucune coordonnée disponible (query absente + profil vide)', async () => {
      const donor = await seedVerifiedDonor(app, prisma);
      // Pas de latitude/longitude sur le profil, pas de query params

      await request(app.getHttpServer() as Express)
        .get('/alerts')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(400);
    });
  });

  // ==========================================================
  //  GET /alerts/my-structure
  // ==========================================================
  describe('GET /alerts/my-structure', () => {
    it('retourne les alertes paginées de la structure', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .get('/alerts/my-structure')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(200);

      expect(res.body.alerts).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('rejette (403) pour un donneur', async () => {
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .get('/alerts/my-structure')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(403);
    });
  });

  // ==========================================================
  //  GET /alerts/:id — accessible à TOUT utilisateur authentifié
  //  (aucun @Roles() sur cette route, confirmé dans le contrôleur)
  // ==========================================================
  describe('GET /alerts/:id', () => {
    it("un donneur peut consulter le détail d'une alerte, même sans y répondre", async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const donor = await seedVerifiedDonor(app, prisma);

      const res = await request(app.getHttpServer() as Express)
        .get(`/alerts/${createRes.body.alert.id}`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.alert.id);
    });

    it('renvoie 404 si introuvable', async () => {
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .get('/alerts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(404);
    });
  });

  // ==========================================================
  //  GET /alerts/:id/responses
  // ==========================================================
  describe('GET /alerts/:id/responses', () => {
    it('retourne le résumé des réponses pour la structure propriétaire', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const donor = await seedVerifiedDonor(app, prisma);
      await prisma.alertResponse.create({
        data: {
          alertId: createRes.body.alert.id,
          donorId: donor.user.id,
          status: 'CONFIRMED',
        },
      });

      const res = await request(app.getHttpServer() as Express)
        .get(`/alerts/${createRes.body.alert.id}/responses`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(200);

      expect(res.body.summary.confirmed).toBe(1);
      expect(res.body.responses).toHaveLength(1);
    });

    it('rejette (403) pour une structure tierce', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const otherCnts = await seedVerifiedCntsDirector(app, prisma);

      await request(app.getHttpServer() as Express)
        .get(`/alerts/${createRes.body.alert.id}/responses`)
        .set('Authorization', `Bearer ${otherCnts.accessToken}`)
        .expect(403);
    });

    it('rejette (403) pour un donneur', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .get(`/alerts/${createRes.body.alert.id}/responses`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(403);
    });
  });

  // ==========================================================
  //  PATCH /alerts/:id/close
  // ==========================================================
  describe('PATCH /alerts/:id/close', () => {
    it('ferme une alerte ACTIVE de sa structure', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .patch(`/alerts/${createRes.body.alert.id}/close`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.closedAt).not.toBeNull();

      expect(eventsServiceMock.emitToAlert).toHaveBeenCalledWith(
        createRes.body.alert.id,
        'alert:closed',
        expect.objectContaining({ status: 'CANCELLED' }),
      );
    });

    it('rejette (400) si déjà fermée', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      await request(app.getHttpServer() as Express)
        .patch(`/alerts/${createRes.body.alert.id}/close`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .patch(`/alerts/${createRes.body.alert.id}/close`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(400);
    });

    it('rejette (403) pour une structure tierce', async () => {
      const cnts = await seedVerifiedCntsDirector(app, prisma);
      const hospital = await seedVerifiedHospitalAgent(app, prisma, {
        affiliatedCntsId: cnts.structureId,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/alerts')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'VITAL',
          latitude: CENTER_LAT,
          longitude: CENTER_LNG,
        })
        .expect(201);

      const otherCnts = await seedVerifiedCntsDirector(app, prisma);

      await request(app.getHttpServer() as Express)
        .patch(`/alerts/${createRes.body.alert.id}/close`)
        .set('Authorization', `Bearer ${otherCnts.accessToken}`)
        .expect(403);
    });
  });
});

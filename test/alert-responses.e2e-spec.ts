// test/alert-responses.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db-helper';
import {
  seedActiveAlert,
  seedVerifiedDonor,
  seedVerifiedCntsDirector,
} from './seeders';
import { PrismaService } from '@/prisma/prisma.service';

describe('AlertResponses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventsServiceMock: {
    emitToAlert: jest.Mock;
    emitToStructure: jest.Mock;
  };

  beforeAll(async () => {
    ({ app, prisma, eventsServiceMock } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================
  //  POST /alert-responses/:alertId/confirm
  // ==========================================================
  describe('POST /alert-responses/:alertId/confirm', () => {
    it('confirme la venue, incrémente le quota, retourne un QR code', async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 2,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      const res = await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({ etaMinutes: 20 })
        .expect(200);

      expect(res.body.qrCode).toMatch(/^VITA-/);
      expect(res.body.isQuotaReached).toBe(false);

      const response = await prisma.alertResponse.findUnique({
        where: {
          alertId_donorId: { alertId, donorId: donor.user.id },
        },
      });
      expect(response!.status).toBe('CONFIRMED');
      expect(response!.etaMinutes).toBe(20);

      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.quantityConfirmed).toBe(1);
      expect(alert!.status).toBe('ACTIVE');

      expect(eventsServiceMock.emitToAlert).toHaveBeenCalledWith(
        alertId,
        'response:new',
        expect.objectContaining({ status: 'CONFIRMED', isQuotaReached: false }),
      );
    });

    it("ferme l'alerte (QUOTA_REACHED) quand le quota est atteint", async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 1,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      const res = await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      expect(res.body.isQuotaReached).toBe(true);

      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.status).toBe('QUOTA_REACHED');
      expect(alert!.closedAt).not.toBeNull();
    });

    it('rejette (404) une alerte introuvable', async () => {
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post('/alert-responses/00000000-0000-0000-0000-000000000000/confirm')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(404);
    });

    it('rejette (400) si le donneur a déjà une confirmation active ailleurs', async () => {
      const { alertId: alertId1 } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 5,
      });
      const { alertId: alertId2 } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 5,
        cnts: { email: 'autre-cnts@test.sn', registrationNumber: 'CNTS-A2' },
      });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId1}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId2}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(400);
    });

    it("rejette (400) si le donneur n'est pas éligible (période d'attente)", async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 5,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      // Mise à jour directe du profil Jambaar — aucun endpoint ne permet
      // de fixer nextEligibilityAt manuellement, c'est du setup.
      await prisma.jambaarsProfile.update({
        where: { userId: donor.user.id },
        data: { nextEligibilityAt: new Date(Date.now() + 30 * 86400000) },
      });

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(400);
    });

    it('rejette (400) une seconde confirmation sur la même alerte', async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 5,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(400);
    });

    it('rejette (403) pour un rôle autre que DONOR', async () => {
      const { alertId, hospital } = await seedActiveAlert(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({})
        .expect(403);
    });
  });

  // ==========================================================
  //  POST /alert-responses/:alertId/decline
  // ==========================================================
  describe('POST /alert-responses/:alertId/decline', () => {
    it('enregistre le refus', async () => {
      const { alertId } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      const response = await prisma.alertResponse.findUnique({
        where: { alertId_donorId: { alertId, donorId: donor.user.id } },
      });
      expect(response!.status).toBe('DECLINED');

      expect(eventsServiceMock.emitToAlert).toHaveBeenCalledWith(
        alertId,
        'response:declined',
        expect.objectContaining({ donorId: donor.user.id }),
      );
    });

    it('est idempotent si déjà décliné', async () => {
      const { alertId } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      const res = await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body.message).toBeDefined();
    });

    it('rejette (400) si le donneur a déjà confirmé', async () => {
      const { alertId } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(400);
    });
  });

  // ==========================================================
  //  PATCH /alert-responses/:alertId/arrived
  // ==========================================================
  describe('PATCH /alert-responses/:alertId/arrived', () => {
    async function confirmedSetup() {
      const setup = await seedActiveAlert(app, prisma, { quantityNeeded: 5 });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${setup.alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      return { ...setup, donor };
    }

    it("marque l'arrivée du donneur", async () => {
      const { alertId, hospital, donor } = await confirmedSetup();

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/arrived`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(200);

      const response = await prisma.alertResponse.findUnique({
        where: { alertId_donorId: { alertId, donorId: donor.user.id } },
      });
      expect(response!.status).toBe('ARRIVED');
      expect(response!.arrivedAt).not.toBeNull();

      expect(eventsServiceMock.emitToAlert).toHaveBeenCalledWith(
        alertId,
        'response:arrived',
        expect.objectContaining({ donorId: donor.user.id }),
      );
    });

    it("un agent d'une AUTRE structure peut aussi marquer l'arrivée (pas de vérification de propriété — comportement actuel documenté)", async () => {
      const { alertId, donor } = await confirmedSetup();
      const otherCnts = await seedVerifiedCntsDirector(app, prisma, {
        email: 'autre-agent@test.sn',
        registrationNumber: 'CNTS-AR1',
      });

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/arrived`)
        .set('Authorization', `Bearer ${otherCnts.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(200);
    });

    it('rejette (404) si aucune réponse pour ce donneur', async () => {
      const { alertId, hospital } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma); // n'a jamais confirmé

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/arrived`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(404);
    });

    it('rejette (400) si le donneur avait décliné', async () => {
      const { alertId, hospital } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/arrived`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(400);
    });

    it('rejette (403) pour un donneur', async () => {
      const { alertId, donor } = await confirmedSetup();

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/arrived`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(403);
    });
  });

  // ==========================================================
  //  PATCH /alert-responses/:alertId/no-show
  // ==========================================================
  describe('PATCH /alert-responses/:alertId/no-show', () => {
    it('réouvre une alerte QUOTA_REACHED lors de l’annulation', async () => {
      const { alertId, cnts } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 1,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      let alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.status).toBe('QUOTA_REACHED');

      const res = await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/cancel`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body.message).toBeDefined();

      alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.status).toBe('ACTIVE');

      expect(eventsServiceMock.emitToStructure).toHaveBeenCalledWith(
        cnts.structureId,
        'alert:reactivated',
        expect.objectContaining({ alertId }),
      );
    });

    it('rejette (404) si aucune réponse pour ce donneur', async () => {
      const { alertId, hospital } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/no-show`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(404);
    });

    it("rejette (400) si le statut n'est ni CONFIRMED ni ARRIVED", async () => {
      const { alertId, hospital } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/no-show`)
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({ donorId: donor.user.id })
        .expect(400);
    });
  });

  // ==========================================================
  //  PATCH /alert-responses/:alertId/cancel
  // ==========================================================
  describe('PATCH /alert-responses/:alertId/cancel', () => {
    it('annule la confirmation et décrémente le quota', async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 5,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/cancel`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      const response = await prisma.alertResponse.findUnique({
        where: { alertId_donorId: { alertId, donorId: donor.user.id } },
      });
      expect(response!.status).toBe('CANCELLED');

      const alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.quantityConfirmed).toBe(0);

      expect(eventsServiceMock.emitToAlert).toHaveBeenCalledWith(
        alertId,
        'response:cancelled',
        expect.objectContaining({ status: 'CANCELLED' }),
      );
    });

    it('réouvre une alerte QUOTA_REACHED lors de l’annulation', async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 1,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      let alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.status).toBe('QUOTA_REACHED');

      const res = await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/cancel`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body.message).toBeDefined();

      alert = await prisma.alert.findUnique({ where: { id: alertId } });
      expect(alert!.status).toBe('ACTIVE');
    });

    it('rejette (400) si la réponse n’est pas CONFIRMED', async () => {
      const { alertId } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/decline`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/cancel`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(400);
    });

    it('rejette (404) si aucune réponse n’existe', async () => {
      const { alertId } = await seedActiveAlert(app, prisma);
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .patch(`/alert-responses/${alertId}/cancel`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(404);
    });
  });

  // ==========================================================
  //  GET /alert-responses/active-confirmation
  // ==========================================================
  describe('GET /alert-responses/active-confirmation', () => {
    it('retourne false sans confirmation active', async () => {
      const donor = await seedVerifiedDonor(app, prisma);

      const res = await request(app.getHttpServer() as Express)
        .get('/alert-responses/active-confirmation')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body.hasActiveConfirmation).toBe(false);
    });

    it('retourne true après une confirmation', async () => {
      const { alertId } = await seedActiveAlert(app, prisma, {
        quantityNeeded: 5,
      });
      const donor = await seedVerifiedDonor(app, prisma);

      await request(app.getHttpServer() as Express)
        .post(`/alert-responses/${alertId}/confirm`)
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .send({})
        .expect(200);

      const res = await request(app.getHttpServer() as Express)
        .get('/alert-responses/active-confirmation')
        .set('Authorization', `Bearer ${donor.accessToken}`)
        .expect(200);

      expect(res.body.hasActiveConfirmation).toBe(true);
    });

    it('rejette (403) pour un agent', async () => {
      const { hospital } = await seedActiveAlert(app, prisma);

      await request(app.getHttpServer() as Express)
        .get('/alert-responses/active-confirmation')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .expect(403);
    });
  });
});

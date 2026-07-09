// test/blood-requests.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db-helper';
// test/blood-requests.e2e-spec.ts
import { seedHospitalCntsPair } from './seeders';
import { PrismaService } from '@/prisma/prisma.service';
import { BloodType } from '@/generated/prisma/enums';

describe('BloodRequests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================
  //  CREATE (hôpital -> CNTS)
  // ==========================================================
  describe('POST /blood-requests', () => {
    it('crée une demande depuis un hôpital affilié', async () => {
      const { hospital } = await seedHospitalCntsPair(app, prisma);

      const res = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 3,
          urgencyLevel: 'VITAL',
        })
        .expect(201);

      expect(res.body.status).toBe('PENDING');
      expect(res.body.bloodType).toBe('O_NEG');
      expect(res.body.requestingHospital.id).toBe(hospital.structureId);
      expect(res.body.handledByCnts.id).toBeDefined();
    });

    it('rejette (403) une tentative de création par un agent CNTS', async () => {
      const { cnts } = await seedHospitalCntsPair(app, prisma);

      await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${cnts.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 3, urgencyLevel: 'VITAL' })
        .expect(403);
    });

    it("rejette (400) si l'hôpital n'est affilié à aucune CNTS", async () => {
      const { hospital } = await seedHospitalCntsPair(app, prisma);

      // On retire l'affiliation directement en base pour simuler ce cas,
      // le DTO d'inscription rendant affiliatedCntsId obligatoire.
      await prisma.healthStructure.update({
        where: { id: hospital.structureId },
        data: { affiliatedCntsId: null },
      });

      await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 3, urgencyLevel: 'VITAL' })
        .expect(400);
    });

    it('rejette (400) une quantité hors bornes', async () => {
      const { hospital } = await seedHospitalCntsPair(app, prisma);

      await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 999,
          urgencyLevel: 'VITAL',
        })
        .expect(400);
    });

    it('rejette (401) sans token', async () => {
      await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .send({ bloodType: 'O_NEG', quantityNeeded: 3, urgencyLevel: 'VITAL' })
        .expect(401);
    });
  });

  // ==========================================================
  //  HANDLE — FULFILL (déclenche la création d'un PurchaseOrder)
  // ==========================================================
  describe('POST /blood-requests/:id/handle — FULFILL', () => {
    async function createPendingRequest(quantityNeeded = 3) {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded,
          urgencyLevel: 'VITAL',
        })
        .expect(201);

      return { ...setup, requestId: createRes.body.id as string };
    }

    it('traite entièrement la demande, décrémente le stock, crée un PurchaseOrder', async () => {
      const { cnts, requestId } = await createPendingRequest(3);

      const res = await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${cnts.accessToken}`)
        .send({ action: 'FULFILL' })
        .expect(200);

      expect(res.body.status).toBe('FULFILLED');
      expect(res.body.quantityProvided).toBe(3);

      // Le PurchaseOrder doit avoir été créé par le listener (emitAsync
      // garantit qu'il est déjà en base au moment de la réponse HTTP).
      expect(res.body.purchaseOrder).not.toBeNull();
      expect(res.body.purchaseOrder.code).toMatch(/^CMD-/);
      expect(res.body.purchaseOrder.quantity).toBe(3);
      expect(res.body.purchaseOrder.status).toBe('PENDING');

      // Le stock doit avoir été décrémenté de 3 (10 -> 7)
      const stock = await prisma.bloodStock.findUnique({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: cnts.structureId,
            bloodType: BloodType.O_NEG,
          },
        },
      });
      expect(stock!.quantity).toBe(7);
    });

    it('rejette (400) si le stock est insuffisant', async () => {
      const { cnts, requestId } = await createPendingRequest(3);

      // On vide le stock après création de la demande
      await prisma.bloodStock.update({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: cnts.structureId,
            bloodType: BloodType.O_NEG,
          },
        },
        data: { quantity: 1 },
      });

      await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${cnts.accessToken}`)
        .send({ action: 'FULFILL' })
        .expect(400);
    });

    it('rejette (403) si une autre CNTS tente de traiter la demande', async () => {
      const { requestId } = await createPendingRequest(3);
      const otherSetup = await seedHospitalCntsPair(app, prisma, {
        cnts: { email: 'autre-cnts@test.sn', registrationNumber: 'CNTS-002' },
      });

      await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${otherSetup.cnts.accessToken}`)
        .send({ action: 'FULFILL' })
        .expect(403);
    });

    it("rejette (400) si la demande n'est plus PENDING", async () => {
      const { cnts, requestId } = await createPendingRequest(3);

      await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${cnts.accessToken}`)
        .send({ action: 'FULFILL' })
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${cnts.accessToken}`)
        .send({ action: 'FULFILL' })
        .expect(400);
    });
  });

  // ==========================================================
  //  HANDLE — PARTIALLY_FULFILL (déclenche PurchaseOrder + Alert)
  // ==========================================================
  describe('POST /blood-requests/:id/handle — PARTIALLY_FULFILL', () => {
    it('traite partiellement, crée un PurchaseOrder ET une Alert liée', async () => {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 5, urgencyLevel: 'VITAL' })
        .expect(201);

      const requestId = createRes.body.id as string;

      const res = await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .send({ action: 'PARTIALLY_FULFILL', quantityProvided: 2 })
        .expect(200);

      expect(res.body.status).toBe('PARTIALLY_FULFILLED');
      expect(res.body.quantityProvided).toBe(2);

      expect(res.body.purchaseOrder).not.toBeNull();
      expect(res.body.purchaseOrder.quantity).toBe(2);

      expect(res.body.escalatedAlert).not.toBeNull();

      const alert = await prisma.alert.findUnique({
        where: { id: res.body.escalatedAlert.id },
      });
      expect(alert!.quantityNeeded).toBe(3);
      expect(alert!.origin).toBe('CNTS_ESCALATION');
      expect(alert!.bloodRequestId).toBe(requestId);
    });

    it("l'alerte n'est pas créée si la CNTS n'est pas vérifiée (échec silencieux du listener)", async () => {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      await prisma.healthStructure.update({
        where: { id: setup.cnts.structureId },
        data: { isVerified: false },
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 5, urgencyLevel: 'VITAL' })
        .expect(201);

      const requestId = createRes.body.id as string;

      const res = await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .send({ action: 'PARTIALLY_FULFILL', quantityProvided: 2 })
        .expect(200);

      expect(res.body.purchaseOrder).not.toBeNull();
      expect(res.body.escalatedAlert).toBeNull();
    });
  });

  describe('POST /blood-requests/:id/handle — ESCALATE', () => {
    it('escalade sans fournir de sang, crée une Alert pour la quantité totale', async () => {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 4, urgencyLevel: 'VITAL' })
        .expect(201);

      const requestId = createRes.body.id as string;

      const res = await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .send({ action: 'ESCALATE' })
        .expect(200);

      expect(res.body.status).toBe('ESCALATED_TO_ALERT');
      expect(res.body.purchaseOrder).toBeNull();
      expect(res.body.escalatedAlert).not.toBeNull();

      const alert = await prisma.alert.findUnique({
        where: { id: res.body.escalatedAlert.id },
      });
      expect(alert!.quantityNeeded).toBe(4);
      expect(alert!.origin).toBe('CNTS_ESCALATION');

      const stock = await prisma.bloodStock.findUnique({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: setup.cnts.structureId,
            bloodType: BloodType.O_NEG,
          },
        },
      });
      expect(stock!.quantity).toBe(10);
    });
  });

  // ==========================================================
  //  HANDLE — ESCALATE (Alert seule, pas de PurchaseOrder)
  // ==========================================================
  describe('POST /blood-requests/:id/handle — ESCALATE', () => {
    it('escalade sans fournir de sang, crée une Alert pour la quantité totale', async () => {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 4, urgencyLevel: 'VITAL' })
        .expect(201);

      const requestId = createRes.body.id as string;

      const res = await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .send({ action: 'ESCALATE' })
        .expect(200);

      expect(res.body.status).toBe('ESCALATED_TO_ALERT');
      expect(res.body.purchaseOrder).toBeNull(); // pas de sang fourni
      expect(res.body.escalatedAlert).not.toBeNull();

      const alert = await prisma.alert.findUnique({
        where: { id: res.body.escalatedAlert.id },
      });
      expect(alert!.quantityNeeded).toBe(4); // quantité totale, pas de reliquat
      expect(alert!.origin).toBe('CNTS_ESCALATION');

      // Le stock ne doit pas avoir bougé (rien n'a été fourni)
      const stock = await prisma.bloodStock.findUnique({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: setup.cnts.structureId,
            bloodType: BloodType.O_NEG,
          },
        },
      });
      expect(stock!.quantity).toBe(10);
    });
  });

  // ==========================================================
  //  HANDLE — REJECT
  // ==========================================================
  describe('POST /blood-requests/:id/handle — REJECT', () => {
    it('rejette la demande sans toucher au stock', async () => {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({ bloodType: 'O_NEG', quantityNeeded: 3, urgencyLevel: 'VITAL' })
        .expect(201);

      const requestId = createRes.body.id as string;

      const res = await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${requestId}/handle`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .send({ action: 'REJECT', cntsNotes: 'Contexte clinique insuffisant' })
        .expect(200);

      expect(res.body.status).toBe('REJECTED');
      expect(res.body.cntsNotes).toBe('Contexte clinique insuffisant');

      const stock = await prisma.bloodStock.findUnique({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: setup.cnts.structureId,
            bloodType: BloodType.O_NEG,
          },
        },
      });
      expect(stock!.quantity).toBe(10);
    });
  });

  // ==========================================================
  //  GET /blood-requests (liste, filtrée par rôle)
  // ==========================================================
  describe('GET /blood-requests', () => {
    it('un hôpital ne voit que ses propres demandes', async () => {
      const setup = await seedHospitalCntsPair(app, prisma);
      const otherSetup = await seedHospitalCntsPair(app, prisma, {
        cnts: { email: 'autre-cnts2@test.sn', registrationNumber: 'CNTS-003' },
      });

      await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
        })
        .expect(201);

      await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${otherSetup.hospital.accessToken}`)
        .send({
          bloodType: 'A_POS',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
        })
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .get('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .expect(200);

      expect(res.body.requests).toHaveLength(1);
      expect(res.body.requests[0].requestingHospital.id).toBe(
        setup.hospital.structureId,
      );
    });

    it('la pagination fonctionne correctement', async () => {
      const setup = await seedHospitalCntsPair(app, prisma);

      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer() as Express)
          .post('/blood-requests')
          .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
          .send({
            bloodType: 'O_NEG',
            quantityNeeded: 1,
            urgencyLevel: 'STANDARD',
          })
          .expect(201);
      }

      const res = await request(app.getHttpServer() as Express)
        .get('/blood-requests?page=1&limit=2')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .expect(200);

      expect(res.body.requests).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
      expect(res.body.pagination.totalPages).toBe(2);
    });
  });

  // ==========================================================
  //  GET /blood-requests/:id
  // ==========================================================
  describe('GET /blood-requests/:id', () => {
    it("refuse (403) l'accès à une structure tierce", async () => {
      const setup = await seedHospitalCntsPair(app, prisma);
      const otherSetup = await seedHospitalCntsPair(app, prisma, {
        cnts: { email: 'autre-cnts3@test.sn', registrationNumber: 'CNTS-004' },
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
        })
        .expect(201);

      await request(app.getHttpServer() as Express)
        .get(`/blood-requests/${createRes.body.id}`)
        .set('Authorization', `Bearer ${otherSetup.hospital.accessToken}`)
        .expect(403);
    });
  });

  // ==========================================================
  //  PATCH /blood-requests/:id/cancel
  // ==========================================================
  describe('PATCH /blood-requests/:id/cancel', () => {
    it("l'hôpital demandeur peut annuler une demande PENDING", async () => {
      const setup = await seedHospitalCntsPair(app, prisma);

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
        })
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .patch(`/blood-requests/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it("rejette (403) si ce n'est pas l'hôpital demandeur", async () => {
      const setup = await seedHospitalCntsPair(app, prisma);

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
        })
        .expect(201);

      await request(app.getHttpServer() as Express)
        .patch(`/blood-requests/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .expect(403);
    });

    it('rejette (400) une demande déjà traitée', async () => {
      const setup = await seedHospitalCntsPair(app, prisma, {
        stockQuantity: 10,
      });

      const createRes = await request(app.getHttpServer() as Express)
        .post('/blood-requests')
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .send({
          bloodType: 'O_NEG',
          quantityNeeded: 2,
          urgencyLevel: 'STANDARD',
        })
        .expect(201);

      await request(app.getHttpServer() as Express)
        .post(`/blood-requests/${createRes.body.id}/handle`)
        .set('Authorization', `Bearer ${setup.cnts.accessToken}`)
        .send({ action: 'REJECT' })
        .expect(200);

      await request(app.getHttpServer() as Express)
        .patch(`/blood-requests/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${setup.hospital.accessToken}`)
        .expect(400);
    });
  });
});

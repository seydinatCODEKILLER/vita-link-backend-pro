import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db-helper';
import { PrismaService } from '@/prisma/prisma.service';

// -------------------------------------------------------------------
// Helpers & Seeders locaux (Module réservé Admin, pas besoin des gros seeders)
// -------------------------------------------------------------------

async function seedAdmin(app: INestApplication, prisma: PrismaService) {
  // Création directe en base pour éviter le flux d'inscription complet
  const user = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'VitaLink',
      email: 'admin-vita@vitalink.sn',
      phone: '+221770000001',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuuVVmqJZOdEJ',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // Génération manuelle d'un token JWT valide pour l'admin
  const { JwtService } = await import('@nestjs/jwt');
  const jwtService = app.get(JwtService);

  const accessToken = jwtService.sign(
    { id: user.id, role: user.role },
    { secret: process.env.JWT_SECRET || 'test-secret' },
  );

  return { accessToken, admin: user };
}

// -------------------------------------------------------------------
// Tests E2E
// -------------------------------------------------------------------

describe('Badges (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventsServiceMock: { emitToDonors: jest.Mock };
  let adminAccessToken: string;

  beforeAll(async () => {
    ({ app, prisma, eventsServiceMock } = await createTestApp());
  });

  beforeEach(async () => {
    const { accessToken } = await seedAdmin(app, prisma);
    adminAccessToken = accessToken;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const VALID_BADGE_DTO = {
    name: 'Guerrier',
    description: 'A effectué 5 dons de sang',
    criteria: '{"minDonations": 5}',
  };

  // ==========================================================
  //  POST /badges
  // ==========================================================
  describe('POST /badges', () => {
    it('crée un badge avec succès (201) et notifie les donneurs', async () => {
      const res = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      expect(res.body.name).toBe(VALID_BADGE_DTO.name);
      expect(res.body.criteria).toBe(VALID_BADGE_DTO.criteria);
      expect(res.body.isActive).toBe(true);
      expect(res.body.id).toBeDefined();

      // Vérification DB
      const badgeInDb = await prisma.badge.findUnique({
        where: { id: res.body.id },
      });
      expect(badgeInDb).not.toBeNull();
      expect(badgeInDb!.name).toBe(VALID_BADGE_DTO.name);

      // Vérification Mock Event
      expect(eventsServiceMock.emitToDonors).toHaveBeenCalledWith(
        'badges:new',
        expect.objectContaining({
          badgeId: res.body.id,
          name: VALID_BADGE_DTO.name,
        }),
      );
    });

    it('crée un badge saisonnier avec tous les champs optionnels', async () => {
      const res = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          ...VALID_BADGE_DTO,
          iconUrl: 'https://res.cloudinary.com/test/icon.png',
          isSeasonal: true,
          season: 'Ramadan 2024',
        })
        .expect(201);

      expect(res.body.isSeasonal).toBe(true);
      expect(res.body.season).toBe('Ramadan 2024');
      expect(res.body.iconUrl).toBe('https://res.cloudinary.com/test/icon.png');
    });

    it('rejette (400) si le JSON des critères est invalide', async () => {
      await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...VALID_BADGE_DTO, criteria: '{ceci-nest-pas-du-json' })
        .expect(400);

      // Vérifie qu'aucun événement n'a été émis
      expect(eventsServiceMock.emitToDonors).not.toHaveBeenCalled();
    });

    it('rejette (400) si le nom est trop court (minLength 2)', async () => {
      await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...VALID_BADGE_DTO, name: 'A' })
        .expect(400);
    });

    it('rejette (400) si une URL invalide est fournie pour iconUrl', async () => {
      await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...VALID_BADGE_DTO, iconUrl: 'pas-une-url' })
        .expect(400);
    });

    it('rejette (401) si non authentifié', async () => {
      await request(app.getHttpServer() as Express)
        .post('/badges')
        .send(VALID_BADGE_DTO)
        .expect(401);
    });

    it("rejette (403) si le rôle n'est pas ADMIN", async () => {
      // Création d'un utilisateur DONOR pour le test
      const donor = await prisma.user.create({
        data: {
          firstName: 'Donor',
          lastName: 'Test',
          email: 'donor@test.sn',
          phone: '+221770000099',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuuVVmqJZOdEJ',
          role: 'DONOR',
          isActive: true,
        },
      });
      const { JwtService } = await import('@nestjs/jwt');
      const jwtService = app.get(JwtService);
      const donorToken = jwtService.sign(
        { id: donor.id, role: donor.role },
        { secret: process.env.JWT_SECRET || 'test-secret' },
      );

      await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${donorToken}`)
        .send(VALID_BADGE_DTO)
        .expect(403);
    });
  });

  // ==========================================================
  //  GET /badges
  // ==========================================================
  describe('GET /badges', () => {
    it('retourne la liste des badges triée par createdAt desc', async () => {
      // Création de 2 badges
      await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...VALID_BADGE_DTO, name: 'Badge Ancien' })
        .expect(201);

      await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ ...VALID_BADGE_DTO, name: 'Badge Récent' })
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .get('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      // Vérifie que le tri desc est appliqué
      expect(res.body[0].name).toBe('Badge Récent');
      expect(res.body[1].name).toBe('Badge Ancien');
    });

    it("retourne un tableau vide si aucun badge n'existe", async () => {
      const res = await request(app.getHttpServer() as Express)
        .get('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  // ==========================================================
  //  PATCH /badges/:id
  // ==========================================================
  describe('PATCH /badges/:id', () => {
    it('met à jour le nom et émet badges:updated', async () => {
      const createRes = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .patch(`/badges/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Vétéran' })
        .expect(200);

      expect(res.body.name).toBe('Vétéran');
      expect(res.body.description).toBe(VALID_BADGE_DTO.description); // Non modifié

      expect(eventsServiceMock.emitToDonors).toHaveBeenCalledWith(
        'badges:updated',
        expect.objectContaining({
          badgeId: createRes.body.id,
          name: 'Vétéran',
        }),
      );
    });

    it("rejette (404) si le badge n'existe pas", async () => {
      await request(app.getHttpServer() as Express)
        .patch('/badges/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ name: 'Inexistant' })
        .expect(404);
    });

    it('rejette (400) si le nouveau criteria est un JSON invalide', async () => {
      const createRes = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      await request(app.getHttpServer() as Express)
        .patch(`/badges/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ criteria: 'invalid' })
        .expect(400);
    });
  });

  // ==========================================================
  //  DELETE /badges/:id (Soft Delete)
  // ==========================================================
  describe('DELETE /badges/:id', () => {
    it('désactive un badge actif (soft delete) et émit badges:deactivated', async () => {
      const createRes = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .delete(`/badges/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.isActive).toBe(false);

      // Vérification DB
      const badgeInDb = await prisma.badge.findUnique({
        where: { id: createRes.body.id },
      });
      expect(badgeInDb).not.toBeNull(); // Toujours en base (soft delete)
      expect(badgeInDb!.isActive).toBe(false);

      expect(eventsServiceMock.emitToDonors).toHaveBeenCalledWith(
        'badges:deactivated',
        expect.objectContaining({ badgeId: createRes.body.id }),
      );
    });

    it("rejette (404) si le badge n'existe pas", async () => {
      await request(app.getHttpServer() as Express)
        .delete('/badges/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it('rejette (409) si le badge est déjà désactivé', async () => {
      const createRes = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      // Première désactivation
      await request(app.getHttpServer() as Express)
        .delete(`/badges/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      // Deuxième tentative
      await request(app.getHttpServer() as Express)
        .delete(`/badges/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(409); // ConflictException
    });
  });

  // ==========================================================
  //  PATCH /badges/:id/reactivate
  // ==========================================================
  describe('PATCH /badges/:id/reactivate', () => {
    it('réactive un badge désactivé et émet badges:new', async () => {
      const createRes = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      // On le désactive d'abord
      await request(app.getHttpServer() as Express)
        .delete(`/badges/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      // On le réactive
      const res = await request(app.getHttpServer() as Express)
        .patch(`/badges/${createRes.body.id}/reactivate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(200);

      expect(res.body.isActive).toBe(true);

      // Le service émet 'badges:new' lors d'une réactivation (cf votre code métier)
      expect(eventsServiceMock.emitToDonors).toHaveBeenCalledWith(
        'badges:new',
        expect.objectContaining({
          badgeId: createRes.body.id,
          name: VALID_BADGE_DTO.name,
        }),
      );
    });

    it("rejette (404) si le badge n'existe pas", async () => {
      await request(app.getHttpServer() as Express)
        .patch('/badges/00000000-0000-0000-0000-000000000000/reactivate')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });

    it('rejette (409) si le badge est déjà actif', async () => {
      const createRes = await request(app.getHttpServer() as Express)
        .post('/badges')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(VALID_BADGE_DTO)
        .expect(201);

      // Tentative de réactivation sans l'avoir désactivé
      await request(app.getHttpServer() as Express)
        .patch(`/badges/${createRes.body.id}/reactivate`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(409); // ConflictException
    });
  });
});

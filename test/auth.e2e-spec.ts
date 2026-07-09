// test/auth.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db-helper';
// test/auth.e2e-spec.ts
import { seedCntsDirector } from './seeders';
import { PrismaService } from '@/prisma/prisma.service';
import { Express } from 'express';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailServiceMock: { sendOtp: jest.Mock };

  beforeAll(async () => {
    ({ app, prisma, emailServiceMock } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  const DONOR_DTO = {
    firstName: 'Aliou',
    lastName: 'Diallo',
    phone: '+221771234567',
    email: 'aliou@gmail.com',
    bloodType: 'O_NEG',
    gender: 'MALE',
  };

  const CNTS_DTO = {
    firstName: 'Dr. Aminata',
    lastName: 'Diop',
    email: 'admin.cnts@transfusion.sn',
    phone: '+221338000000',
    password: 'CntsSecure2024!',
    structureName: 'Centre National de Transfusion Sanguine de Dakar',
    registrationNumber: 'CNTS-DKR-001',
    address: 'Avenue Blaise Diagne, Dakar',
    region: 'Dakar',
  };

  // ==========================================================
  //  INSCRIPTION DONNEUR
  // ==========================================================
  describe('POST /auth/register/donor', () => {
    it('crée le compte, envoie un OTP réel en DB, et permet de le vérifier', async () => {
      const registerRes = await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(DONOR_DTO)
        .expect(200); // @HttpCode(HttpStatus.OK) dans le contrôleur

      expect(registerRes.body.email).toBe(DONOR_DTO.email);
      expect(emailServiceMock.sendOtp).toHaveBeenCalledTimes(1);
      expect(emailServiceMock.sendOtp).toHaveBeenCalledWith(
        DONOR_DTO.email,
        DONOR_DTO.firstName,
        expect.any(String),
      );

      const user = await prisma.user.findUnique({
        where: { email: DONOR_DTO.email },
        include: { jambaarsProfile: true },
      });
      expect(user).not.toBeNull();
      expect(user!.role).toBe('DONOR');
      expect(user!.jambaarsProfile?.currentGrade).toBe('ASPIRANT');
      expect(user!.jambaarsProfile?.totalPoints).toBe(0);

      const otpRecord = await prisma.otpCode.findFirst({
        where: { email: DONOR_DTO.email },
        orderBy: { createdAt: 'desc' },
      });
      expect(otpRecord).not.toBeNull();
      expect(otpRecord!.used).toBe(false);
    });

    it("retourne requiresEmail: true et ne crée pas de compte si l'email est absent", async () => {
      const { email: _email, ...dtoSansEmail } = DONOR_DTO;
      console.log(_email);

      const res = await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(dtoSansEmail)
        .expect(200);

      expect(res.body.requiresEmail).toBe(true);

      const user = await prisma.user.findUnique({
        where: { phone: DONOR_DTO.phone },
      });
      expect(user).toBeNull();
      expect(emailServiceMock.sendOtp).not.toHaveBeenCalled();
    });

    it('rejette (409) une inscription avec un téléphone déjà utilisé', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(DONOR_DTO)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send({ ...DONOR_DTO, email: 'autre@gmail.com' })
        .expect(409);

      const count = await prisma.user.count({
        where: { phone: DONOR_DTO.phone },
      });
      expect(count).toBe(1);
    });

    it('rejette (409) une inscription avec un email déjà utilisé', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(DONOR_DTO)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send({ ...DONOR_DTO, phone: '+221779999999' })
        .expect(409);
    });

    it('rejette (400) un payload invalide (bloodType inexistant)', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send({ ...DONOR_DTO, bloodType: 'INVALIDE' })
        .expect(400);
    });
  });

  // ==========================================================
  //  OTP SEND / VERIFY
  // ==========================================================
  describe('POST /auth/otp/verify', () => {
    beforeEach(async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(DONOR_DTO)
        .expect(200);
    });

    it('valide le bon code et retourne des tokens persistés en base', async () => {
      const otp = await prisma.otpCode.findFirst({
        where: { email: DONOR_DTO.email },
        orderBy: { createdAt: 'desc' },
      });

      const res = await request(app.getHttpServer() as Express)
        .post('/auth/otp/verify')
        .send({ email: DONOR_DTO.email, code: otp!.code })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(DONOR_DTO.email);

      const user = await prisma.user.findUnique({
        where: { email: DONOR_DTO.email },
      });
      expect(user!.refreshToken).toBe(res.body.refreshToken);
      expect(user!.refreshTokenExpiresAt).not.toBeNull();

      const otpAfter = await prisma.otpCode.findUnique({
        where: { id: otp!.id },
      });
      expect(otpAfter!.used).toBe(true);
    });

    it('rejette (400) un code incorrect', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/otp/verify')
        .send({ email: DONOR_DTO.email, code: '000000' })
        .expect(400);
    });

    it('rejette (400) un code déjà utilisé (pas de rejeu possible)', async () => {
      const otp = await prisma.otpCode.findFirst({
        where: { email: DONOR_DTO.email },
        orderBy: { createdAt: 'desc' },
      });

      await request(app.getHttpServer() as Express)
        .post('/auth/otp/verify')
        .send({ email: DONOR_DTO.email, code: otp!.code })
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post('/auth/otp/verify')
        .send({ email: DONOR_DTO.email, code: otp!.code })
        .expect(400);
    });

    it('invalide les anciens codes quand un nouvel OTP est demandé', async () => {
      const firstOtp = await prisma.otpCode.findFirst({
        where: { email: DONOR_DTO.email },
        orderBy: { createdAt: 'desc' },
      });

      await request(app.getHttpServer() as Express)
        .post('/auth/otp/send')
        .send({ email: DONOR_DTO.email })
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post('/auth/otp/verify')
        .send({ email: DONOR_DTO.email, code: firstOtp!.code })
        .expect(400);
    });
  });

  // ==========================================================
  //  INSCRIPTION CNTS
  // ==========================================================
  describe('POST /auth/register/cnts', () => {
    it('crée la structure CNTS et son directeur', async () => {
      const res = await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);

      expect(res.body.structure.id).toBeDefined();
      expect(res.body.director.id).toBeDefined();

      const structure = await prisma.healthStructure.findUnique({
        where: { registrationNumber: CNTS_DTO.registrationNumber },
      });
      expect(structure).not.toBeNull();
      expect(structure!.structureType).toBe('CNTS');

      const director = await prisma.user.findUnique({
        where: { email: CNTS_DTO.email },
      });
      expect(director!.isStructureAdmin).toBe(true);
      expect(director!.passwordHash).not.toBe(CNTS_DTO.password);
      expect(director!.healthStructureId).toBe(structure!.id);
    });

    it("rejette (409) un numéro d'enregistrement déjà utilisé", async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);

      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send({ ...CNTS_DTO, email: 'autre@transfusion.sn' })
        .expect(409);
    });

    it('rejette (409) un email déjà utilisé par un autre compte', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);

      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send({
          ...CNTS_DTO,
          registrationNumber: 'CNTS-DKR-002',
          phone: '+221338000001',
        })
        .expect(409);
    });
  });

  // ==========================================================
  //  INSCRIPTION HOPITAL (dépend d'une CNTS existante)
  // ==========================================================
  describe('POST /auth/register/hospital', () => {
    let cntsStructureId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);
      cntsStructureId = res.body.structure.id;
    });

    const hospitalDto = () => ({
      firstName: 'Dr. Moussa',
      lastName: 'Sow',
      email: 'dr.sow@hpd.sn',
      phone: '+221771234567',
      password: 'Motdepasse123!',
      structureName: 'Hôpital Principal de Dakar',
      registrationNumber: 'SN-MED-2024-001',
      address: 'Avenue Nelson Mandela, Dakar',
      region: 'Dakar',
      structureType: 'HOSPITAL',
      affiliatedCntsId: cntsStructureId,
    });

    it("inscrit l'hôpital quand la CNTS d'affiliation existe", async () => {
      const res = await request(app.getHttpServer() as Express)
        .post('/auth/register/hospital')
        .send(hospitalDto())
        .expect(201);

      expect(res.body.structure.id).toBeDefined();

      const structure = await prisma.healthStructure.findUnique({
        where: { id: res.body.structure.id },
      });
      expect(structure!.affiliatedCntsId).toBe(cntsStructureId);
    });

    it("rejette (404) si la CNTS d'affiliation n'existe pas", async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/hospital')
        .send({
          ...hospitalDto(),
          affiliatedCntsId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });
  });

  // ==========================================================
  //  LOGIN (agents de structure)
  // ==========================================================
  describe('POST /auth/login', () => {
    it('connecte un directeur CNTS avec les bons identifiants', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);

      const res = await request(app.getHttpServer() as Express)
        .post('/auth/login')
        .send({ email: CNTS_DTO.email, password: CNTS_DTO.password })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(CNTS_DTO.email);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('renvoie 401 pour un mot de passe incorrect', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);

      await request(app.getHttpServer() as Express)
        .post('/auth/login')
        .send({ email: CNTS_DTO.email, password: 'mauvais-mdp' })
        .expect(401);
    });

    it("renvoie 401 (pas 404) pour un email inconnu, contre l'énumération", async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/login')
        .send({ email: 'personne@inconnu.sn', password: 'peuimporte' })
        .expect(401);
    });

    it('renvoie 401 si un donneur tente un login par mot de passe (pas de passwordHash)', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(DONOR_DTO)
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post('/auth/login')
        .send({ email: DONOR_DTO.email, password: 'peuimporte' })
        .expect(401);
    });

    it('renvoie 403 si le compte structure est suspendu', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/cnts')
        .send(CNTS_DTO)
        .expect(201);

      await prisma.user.update({
        where: { email: CNTS_DTO.email },
        data: { isActive: false },
      });

      await request(app.getHttpServer() as Express)
        .post('/auth/login')
        .send({ email: CNTS_DTO.email, password: CNTS_DTO.password })
        .expect(403);
    });
  });

  // ==========================================================
  //  REFRESH / LOGOUT — cycle complet du token
  // ==========================================================
  describe('Cycle refresh / logout', () => {
    it('permet de rafraîchir les tokens avec un refresh token valide', async () => {
      await seedCntsDirector(app, { email: 'director-refresh@test.sn' });

      const loginRes = await request(app.getHttpServer() as Express)
        .post('/auth/login')
        .send({
          email: 'director-refresh@test.sn',
          password: 'CntsSecure2024!',
        })
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const refreshRes = await request(app.getHttpServer() as Express)
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(200);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(loginRes.body.refreshToken);

      await request(app.getHttpServer() as Express)
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });

    it('un refresh token révoqué par logout ne peut plus être utilisé', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/register/donor')
        .send(DONOR_DTO)
        .expect(200);
      const otp = await prisma.otpCode.findFirst({
        where: { email: DONOR_DTO.email },
        orderBy: { createdAt: 'desc' },
      });
      const { body: tokens } = await request(app.getHttpServer() as Express)
        .post('/auth/otp/verify')
        .send({ email: DONOR_DTO.email, code: otp!.code })
        .expect(200);

      await request(app.getHttpServer() as Express)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      const user = await prisma.user.findUnique({
        where: { email: DONOR_DTO.email },
      });
      expect(user!.refreshToken).toBeNull();

      await request(app.getHttpServer() as Express)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('renvoie 401 pour un refresh token invalide/malformé', async () => {
      await request(app.getHttpServer() as Express)
        .post('/auth/refresh')
        .send({ refreshToken: 'token-completement-invalide' })
        .expect(401);
    });
  });
});

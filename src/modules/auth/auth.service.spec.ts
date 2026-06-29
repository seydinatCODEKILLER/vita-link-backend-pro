import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { HealthStructuresRepository } from '@/modules/health-structures/health-structures.repository';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { AuthEmailService } from './email.service';
import { comparePassword, hashPassword } from '@/common/utils/hasher.utils';
import { Role, BloodType, Gender } from '@/generated/prisma/enums';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { RegisterCntsDto } from './dto/register-cnts.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';

jest.mock('@/common/utils/hasher.utils', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

const mockedComparePassword = comparePassword as jest.MockedFunction<
  typeof comparePassword
>;
const mockedHashPassword = hashPassword as jest.MockedFunction<
  typeof hashPassword
>;

const createMockAuthRepository = () => ({
  findByPhone: jest.fn(),
  findByEmail: jest.fn(),
  findByEmailWithRole: jest.fn(),
  findDonorByEmail: jest.fn(),
  findByRefreshToken: jest.fn(),
  createDonor: jest.fn(),
  storeRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
});

const createMockHealthStructuresRepository = () => ({
  createCntsWithDirector: jest.fn(),
  createHospitalWithDirector: jest.fn(),
  findValidCntsById: jest.fn(),
  findByRegistrationNumber: jest.fn(),
});

const createMockOtpService = () => ({
  send: jest.fn(),
  verifyAndConsume: jest.fn(),
});

const createMockTokenService = () => ({
  issueAndStore: jest.fn(),
  rotate: jest.fn(),
  revoke: jest.fn(),
});

const createMockEmailService = () => ({
  sendOtp: jest.fn(),
});

const createMockConfigService = () => ({
  get: jest.fn(),
});

const TOKENS = { accessToken: 'access-token', refreshToken: 'refresh-token' };

const DONOR_DTO: RegisterDonorDto = {
  firstName: 'Aliou',
  lastName: 'Diallo',
  phone: '+221771234567',
  email: 'aliou@gmail.com',
  bloodType: BloodType.O_NEG,
  gender: Gender.MALE,
};

const DONOR_USER = {
  id: 'donor-1',
  email: 'aliou@gmail.com',
  phone: '+221771234567',
  firstName: 'Aliou',
  lastName: 'Diallo',
  role: Role.DONOR,
  bloodType: BloodType.O_NEG,
  gender: Gender.MALE,
  isActive: true,
  isAvailable: true,
  jambaarsProfile: {
    totalPoints: 0,
    currentGrade: 'ASPIRANT',
    donationCount: 0,
    nextEligibilityAt: null,
    lastDonationAt: null,
  },
};

const CNTS_DTO: RegisterCntsDto = {
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

const HOSPITAL_DTO: RegisterHospitalDto = {
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
  affiliatedCntsId: 'cnts-1',
};

const STRUCTURE_AGENT_USER = {
  id: 'agent-1',
  email: 'dr.sow@hpd.sn',
  passwordHash: 'hashed-password',
  firstName: 'Moussa',
  lastName: 'Sow',
  role: Role.HOSPITAL_AGENT,
  isActive: true,
  isStructureAdmin: true,
  healthStructureId: 'structure-1',
};

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: ReturnType<typeof createMockAuthRepository>;
  let healthStructuresRepository: ReturnType<
    typeof createMockHealthStructuresRepository
  >;
  let otpService: ReturnType<typeof createMockOtpService>;
  let tokenService: ReturnType<typeof createMockTokenService>;
  let emailService: ReturnType<typeof createMockEmailService>;
  let config: ReturnType<typeof createMockConfigService>;

  beforeEach(async () => {
    authRepository = createMockAuthRepository();
    healthStructuresRepository = createMockHealthStructuresRepository();
    otpService = createMockOtpService();
    tokenService = createMockTokenService();
    emailService = createMockEmailService();
    config = createMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        {
          provide: HealthStructuresRepository,
          useValue: healthStructuresRepository,
        },
        { provide: OtpService, useValue: otpService },
        { provide: TokenService, useValue: tokenService },
        { provide: AuthEmailService, useValue: emailService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerDonor', () => {
    beforeEach(() => {
      authRepository.findByPhone.mockResolvedValue(null);
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createDonor.mockResolvedValue(DONOR_USER);
      otpService.send.mockResolvedValue('123456');
      emailService.sendOtp.mockResolvedValue(undefined);
    });

    it('crée le compte et envoie un OTP quand un email est fourni', async () => {
      const result = await service.registerDonor(DONOR_DTO);

      expect(authRepository.createDonor).toHaveBeenCalledWith({
        ...DONOR_DTO,
        email: DONOR_DTO.email,
      });
      expect(otpService.send).toHaveBeenCalledWith(DONOR_DTO.email);
      expect(emailService.sendOtp).toHaveBeenCalledWith(
        DONOR_DTO.email,
        DONOR_DTO.firstName,
        '123456',
      );
      expect(result.email).toBe(DONOR_DTO.email);
      expect(result.message).toBeDefined();
    });

    it("retourne requiresEmail: true et ne crée pas de compte si l'email est absent", async () => {
      const dtoSansEmail = { ...DONOR_DTO, email: undefined };

      const result = await service.registerDonor(dtoSansEmail);

      expect(authRepository.createDonor).not.toHaveBeenCalled();
      expect(otpService.send).not.toHaveBeenCalled();
      expect(result).toEqual({
        message:
          'Numéro disponible. Fournissez votre email pour recevoir le code de vérification.',
        requiresEmail: true,
        phone: DONOR_DTO.phone,
      });
    });

    it('lève ConflictException si le téléphone est déjà utilisé', async () => {
      authRepository.findByPhone.mockResolvedValue(DONOR_USER);

      await expect(service.registerDonor(DONOR_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(authRepository.createDonor).not.toHaveBeenCalled();
    });

    it("lève ConflictException si l'email est déjà utilisé", async () => {
      authRepository.findByEmail.mockResolvedValue(DONOR_USER);

      await expect(service.registerDonor(DONOR_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(authRepository.createDonor).not.toHaveBeenCalled();
    });

    it("ne vérifie pas l'email si celui-ci n'est pas fourni", async () => {
      const dtoSansEmail = { ...DONOR_DTO, email: undefined };

      await service.registerDonor(dtoSansEmail);

      expect(authRepository.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('sendOtp', () => {
    it('envoie un OTP pour un donneur actif', async () => {
      authRepository.findByEmailWithRole.mockResolvedValue({
        id: 'donor-1',
        email: 'aliou@gmail.com',
        role: Role.DONOR,
        isActive: true,
        firstName: 'Aliou',
      });
      otpService.send.mockResolvedValue('654321');

      const result = await service.sendOtp({ email: 'aliou@gmail.com' });

      expect(otpService.send).toHaveBeenCalledWith('aliou@gmail.com');
      expect(emailService.sendOtp).toHaveBeenCalledWith(
        'aliou@gmail.com',
        'Aliou',
        '654321',
      );
      expect(result.message).toBeDefined();
    });

    it('lève NotFoundException si aucun compte ne correspond', async () => {
      authRepository.findByEmailWithRole.mockResolvedValue(null);

      await expect(
        service.sendOtp({ email: 'inconnu@gmail.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si l'utilisateur n'est pas un donneur", async () => {
      authRepository.findByEmailWithRole.mockResolvedValue({
        id: 'agent-1',
        email: 'dr.sow@hpd.sn',
        role: Role.HOSPITAL_AGENT,
        isActive: true,
        firstName: 'Moussa',
      });

      await expect(service.sendOtp({ email: 'dr.sow@hpd.sn' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(otpService.send).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si le compte est suspendu', async () => {
      authRepository.findByEmailWithRole.mockResolvedValue({
        id: 'donor-1',
        email: 'aliou@gmail.com',
        role: Role.DONOR,
        isActive: false,
        firstName: 'Aliou',
      });

      await expect(
        service.sendOtp({ email: 'aliou@gmail.com' }),
      ).rejects.toThrow(ForbiddenException);
      expect(otpService.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    beforeEach(() => {
      otpService.verifyAndConsume.mockResolvedValue(undefined);
      authRepository.findDonorByEmail.mockResolvedValue(DONOR_USER);
      tokenService.issueAndStore.mockResolvedValue(TOKENS);
    });

    it('vérifie le code, émet les tokens et retourne le user', async () => {
      const result = await service.verifyOtp({
        email: 'aliou@gmail.com',
        code: '123456',
      });

      expect(otpService.verifyAndConsume).toHaveBeenCalledWith(
        'aliou@gmail.com',
        '123456',
      );
      expect(tokenService.issueAndStore).toHaveBeenCalledWith({
        id: DONOR_USER.id,
        role: DONOR_USER.role,
      });
      expect(result.accessToken).toBe(TOKENS.accessToken);
      expect(result.refreshToken).toBe(TOKENS.refreshToken);
      expect(result.user).toEqual(DONOR_USER);
      expect(result.message).toBeDefined();
    });

    it("lève NotFoundException si l'utilisateur n'existe pas après vérification", async () => {
      authRepository.findDonorByEmail.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ email: 'aliou@gmail.com', code: '123456' }),
      ).rejects.toThrow(NotFoundException);
      expect(tokenService.issueAndStore).not.toHaveBeenCalled();
    });

    it("propage l'erreur si le code OTP est invalide", async () => {
      otpService.verifyAndConsume.mockRejectedValue(
        new Error('Code OTP invalide ou expiré'),
      );

      await expect(
        service.verifyOtp({ email: 'aliou@gmail.com', code: '000000' }),
      ).rejects.toThrow('Code OTP invalide ou expiré');
      expect(authRepository.findDonorByEmail).not.toHaveBeenCalled();
    });
  });

  describe('registerCnts', () => {
    beforeEach(() => {
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.findByPhone.mockResolvedValue(null);
      healthStructuresRepository.findByRegistrationNumber.mockResolvedValue(
        null,
      );
      mockedHashPassword.mockResolvedValue('hashed-password');
      healthStructuresRepository.createCntsWithDirector.mockResolvedValue({
        structure: { id: 'structure-1', name: CNTS_DTO.structureName },
        director: { id: 'director-1', email: CNTS_DTO.email },
      });
    });

    it('inscrit la CNTS et son directeur', async () => {
      const result = await service.registerCnts(CNTS_DTO);

      expect(mockedHashPassword).toHaveBeenCalledWith(CNTS_DTO.password);
      expect(
        healthStructuresRepository.createCntsWithDirector,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          ...CNTS_DTO,
          passwordHash: 'hashed-password',
        }),
      );
      expect(result.structure.id).toBe('structure-1');
      expect(result.director.id).toBe('director-1');
      expect(result.message).toBeDefined();
    });

    it("lève ConflictException si l'email est déjà utilisé", async () => {
      authRepository.findByEmail.mockResolvedValue(STRUCTURE_AGENT_USER);

      await expect(service.registerCnts(CNTS_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(
        healthStructuresRepository.createCntsWithDirector,
      ).not.toHaveBeenCalled();
    });

    it('lève ConflictException si le téléphone est déjà utilisé', async () => {
      authRepository.findByPhone.mockResolvedValue(STRUCTURE_AGENT_USER);

      await expect(service.registerCnts(CNTS_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(
        healthStructuresRepository.createCntsWithDirector,
      ).not.toHaveBeenCalled();
    });

    it("lève ConflictException si le numéro d'enregistrement est déjà utilisé", async () => {
      healthStructuresRepository.findByRegistrationNumber.mockResolvedValue({
        id: 'structure-existante',
      });

      await expect(service.registerCnts(CNTS_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(
        healthStructuresRepository.createCntsWithDirector,
      ).not.toHaveBeenCalled();
    });
  });

  describe('registerHospital', () => {
    beforeEach(() => {
      healthStructuresRepository.findValidCntsById.mockResolvedValue({
        id: 'cnts-1',
        name: 'CNTS de Dakar',
      });
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.findByPhone.mockResolvedValue(null);
      healthStructuresRepository.findByRegistrationNumber.mockResolvedValue(
        null,
      );
      mockedHashPassword.mockResolvedValue('hashed-password');
      healthStructuresRepository.createHospitalWithDirector.mockResolvedValue({
        structure: { id: 'structure-1', name: HOSPITAL_DTO.structureName },
        director: { id: 'director-1', email: HOSPITAL_DTO.email },
      });
    });

    it("inscrit l'hôpital et son directeur quand la CNTS d'affiliation est valide", async () => {
      const result = await service.registerHospital(HOSPITAL_DTO);

      expect(healthStructuresRepository.findValidCntsById).toHaveBeenCalledWith(
        HOSPITAL_DTO.affiliatedCntsId,
      );
      expect(mockedHashPassword).toHaveBeenCalledWith(HOSPITAL_DTO.password);
      expect(
        healthStructuresRepository.createHospitalWithDirector,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          ...HOSPITAL_DTO,
          passwordHash: 'hashed-password',
        }),
      );
      expect(result.structure.id).toBe('structure-1');
      expect(result.message).toBeDefined();
    });

    it("lève NotFoundException si la CNTS d'affiliation est introuvable", async () => {
      healthStructuresRepository.findValidCntsById.mockResolvedValue(null);

      await expect(service.registerHospital(HOSPITAL_DTO)).rejects.toThrow(
        NotFoundException,
      );
      expect(
        healthStructuresRepository.createHospitalWithDirector,
      ).not.toHaveBeenCalled();
      expect(authRepository.findByEmail).not.toHaveBeenCalled();
    });

    it("lève ConflictException si l'email est déjà utilisé", async () => {
      authRepository.findByEmail.mockResolvedValue(STRUCTURE_AGENT_USER);

      await expect(service.registerHospital(HOSPITAL_DTO)).rejects.toThrow(
        ConflictException,
      );
      expect(
        healthStructuresRepository.createHospitalWithDirector,
      ).not.toHaveBeenCalled();
    });

    it("lève ConflictException si le numéro d'enregistrement est déjà utilisé", async () => {
      healthStructuresRepository.findByRegistrationNumber.mockResolvedValue({
        id: 'structure-existante',
      });

      await expect(service.registerHospital(HOSPITAL_DTO)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    beforeEach(() => {
      config.get.mockReturnValue('dummy-hash');
      tokenService.issueAndStore.mockResolvedValue(TOKENS);
    });

    it('connecte un agent de structure avec des identifiants valides', async () => {
      authRepository.findByEmail.mockResolvedValue(STRUCTURE_AGENT_USER);
      mockedComparePassword.mockResolvedValue(true);

      const result = await service.login({
        email: 'dr.sow@hpd.sn',
        password: 'Motdepasse123!',
      });

      expect(mockedComparePassword).toHaveBeenCalledWith(
        'Motdepasse123!',
        STRUCTURE_AGENT_USER.passwordHash,
      );
      expect(tokenService.issueAndStore).toHaveBeenCalledWith({
        id: STRUCTURE_AGENT_USER.id,
        role: STRUCTURE_AGENT_USER.role,
      });
      expect(result.accessToken).toBe(TOKENS.accessToken);
      expect(result.user).toEqual({
        id: STRUCTURE_AGENT_USER.id,
        email: STRUCTURE_AGENT_USER.email,
        firstName: STRUCTURE_AGENT_USER.firstName,
        lastName: STRUCTURE_AGENT_USER.lastName,
        role: STRUCTURE_AGENT_USER.role,
        isStructureAdmin: STRUCTURE_AGENT_USER.isStructureAdmin,
        healthStructureId: STRUCTURE_AGENT_USER.healthStructureId,
      });
    });

    it('lève UnauthorizedException si le mot de passe est incorrect', async () => {
      authRepository.findByEmail.mockResolvedValue(STRUCTURE_AGENT_USER);
      mockedComparePassword.mockResolvedValue(false);

      await expect(
        service.login({ email: 'dr.sow@hpd.sn', password: 'mauvais' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(tokenService.issueAndStore).not.toHaveBeenCalled();
    });

    it("lève UnauthorizedException si l'email est introuvable (protection timing-safe)", async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      mockedComparePassword.mockResolvedValue(false);

      await expect(
        service.login({ email: 'inconnu@hpd.sn', password: 'peuimporte' }),
      ).rejects.toThrow(UnauthorizedException);

      // Même en l'absence d'utilisateur, comparePassword doit être appelé
      // avec le dummyHash pour éviter une attaque par timing/énumération.
      expect(mockedComparePassword).toHaveBeenCalledWith(
        'peuimporte',
        'dummy-hash',
      );
    });

    it('lève ForbiddenException si le compte est suspendu', async () => {
      authRepository.findByEmail.mockResolvedValue({
        ...STRUCTURE_AGENT_USER,
        isActive: false,
      });
      mockedComparePassword.mockResolvedValue(true);

      await expect(
        service.login({
          email: 'dr.sow@hpd.sn',
          password: 'Motdepasse123!',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(tokenService.issueAndStore).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si le compte est un donneur (doit utiliser OTP)', async () => {
      authRepository.findByEmail.mockResolvedValue({
        ...STRUCTURE_AGENT_USER,
        role: Role.DONOR,
      });
      mockedComparePassword.mockResolvedValue(true);

      await expect(
        service.login({
          email: 'aliou@gmail.com',
          password: 'Motdepasse123!',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(tokenService.issueAndStore).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('délègue la rotation du token au TokenService', async () => {
      tokenService.rotate.mockResolvedValue(TOKENS);

      const result = await service.refresh({ refreshToken: 'old-token' });

      expect(tokenService.rotate).toHaveBeenCalledWith('old-token');
      expect(result).toEqual(TOKENS);
    });
  });

  describe('logout', () => {
    it('révoque le refresh token et retourne un message', async () => {
      tokenService.revoke.mockResolvedValue(undefined);

      const result = await service.logout('user-1');

      expect(tokenService.revoke).toHaveBeenCalledWith('user-1');
      expect(result.message).toBeDefined();
    });
  });
});

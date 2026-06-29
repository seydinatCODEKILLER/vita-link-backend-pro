import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { AuthRepository } from './auth.repository';
import { Role } from '@/generated/prisma/enums';

const createMockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const createMockConfigService = () => ({
  getOrThrow: jest.fn(),
  get: jest.fn(),
});

const createMockAuthRepository = () => ({
  storeRefreshToken: jest.fn(),
  findByRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
});

const USER = { id: 'user-1', role: Role.DONOR };

const CONFIG_VALUES: Record<string, string> = {
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_DURATION: '30d',
};

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let config: ReturnType<typeof createMockConfigService>;
  let authRepository: ReturnType<typeof createMockAuthRepository>;

  beforeEach(async () => {
    jwtService = createMockJwtService();
    config = createMockConfigService();
    authRepository = createMockAuthRepository();

    config.getOrThrow.mockImplementation((key: string) => {
      if (!(key in CONFIG_VALUES)) {
        throw new Error(`Config manquante: ${key}`);
      }
      return CONFIG_VALUES[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: AuthRepository, useValue: authRepository },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildPair', () => {
    it('génère un access token et un refresh token avec les bons payloads', () => {
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = service.buildPair(USER.id, USER.role);

      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        id: USER.id,
        role: USER.role,
      });
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { id: USER.id, role: USER.role },
        {
          secret: 'refresh-secret',
          expiresIn: '30d',
        },
      );
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('calcule expiresAt à environ 30 jours dans le futur', () => {
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      const before = Date.now();

      const result = service.buildPair(USER.id, USER.role);

      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      const diff = result.expiresAt.getTime() - before;
      expect(diff).toBeGreaterThan(expectedMs - 5000);
      expect(diff).toBeLessThanOrEqual(expectedMs + 5000);
    });
  });

  describe('issueAndStore', () => {
    beforeEach(() => {
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      authRepository.storeRefreshToken.mockResolvedValue({});
    });

    it('construit les tokens et les stocke via le repository', async () => {
      const result = await service.issueAndStore(USER);

      expect(authRepository.storeRefreshToken).toHaveBeenCalledWith(
        USER.id,
        'refresh-token',
        expect.any(Date),
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('ne retourne pas expiresAt dans le résultat final', async () => {
      const result = await service.issueAndStore(USER);

      expect(result).not.toHaveProperty('expiresAt');
    });
  });

  describe('rotate', () => {
    const DECODED_PAYLOAD = { id: 'user-1', role: Role.DONOR };
    const STORED_USER = {
      id: 'user-1',
      role: Role.DONOR,
      isActive: true,
      refreshToken: 'old-refresh-token',
    };

    beforeEach(() => {
      config.get.mockReturnValue('refresh-secret');
      jwtService.verify.mockReturnValue(DECODED_PAYLOAD);
      authRepository.findByRefreshToken.mockResolvedValue(STORED_USER);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      authRepository.storeRefreshToken.mockResolvedValue({});
    });

    it('vérifie le refresh token et retourne une nouvelle paire de tokens', async () => {
      const result = await service.rotate('old-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'refresh-secret',
      });
      expect(authRepository.findByRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token',
      );
      expect(authRepository.storeRefreshToken).toHaveBeenCalledWith(
        DECODED_PAYLOAD.id,
        'new-refresh-token',
        expect.any(Date),
      );
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('lève UnauthorizedException si le token JWT est invalide ou expiré', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.rotate('token-invalide')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepository.findByRefreshToken).not.toHaveBeenCalled();
    });

    it('lève UnauthorizedException si aucun utilisateur ne correspond au token (session révoquée)', async () => {
      authRepository.findByRefreshToken.mockResolvedValue(null);

      await expect(service.rotate('old-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepository.storeRefreshToken).not.toHaveBeenCalled();
    });

    it('lève UnauthorizedException si le compte est suspendu', async () => {
      authRepository.findByRefreshToken.mockResolvedValue({
        ...STORED_USER,
        isActive: false,
      });

      await expect(service.rotate('old-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authRepository.storeRefreshToken).not.toHaveBeenCalled();
    });

    it('utilise le payload décodé (id/role) plutôt que les valeurs du user stocké', async () => {
      jwtService.verify.mockReturnValue({ id: 'user-1', role: Role.ADMIN });
      authRepository.findByRefreshToken.mockResolvedValue({
        ...STORED_USER,
        role: Role.DONOR,
      });

      await service.rotate('old-refresh-token');

      // Le 1er sign() (access token) doit utiliser le rôle décodé du JWT
      expect(jwtService.sign).toHaveBeenNthCalledWith(1, {
        id: 'user-1',
        role: Role.ADMIN,
      });
    });
  });

  describe('revoke', () => {
    it('révoque le refresh token via le repository', async () => {
      authRepository.revokeRefreshToken.mockResolvedValue({});

      await service.revoke('user-1');

      expect(authRepository.revokeRefreshToken).toHaveBeenCalledWith('user-1');
    });
  });
});

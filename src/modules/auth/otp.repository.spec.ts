import { Test, TestingModule } from '@nestjs/testing';
import { OtpRepository } from './otp.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  otpCode: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
});

const OTP_RECORD = {
  id: 'otp-1',
  email: 'aliou@gmail.com',
  code: '123456',
  expiresAt: new Date('2026-06-25T10:10:00'),
  used: false,
  createdAt: new Date('2026-06-25T10:00:00'),
};

describe('OtpRepository', () => {
  let repository: OtpRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OtpRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repository = module.get(OtpRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findValidOtp', () => {
    it('retourne le dernier OTP non utilisé pour cet email', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(OTP_RECORD);

      const result = await repository.findValidOtp('aliou@gmail.com');

      expect(prisma.otpCode.findFirst).toHaveBeenCalledWith({
        where: { email: 'aliou@gmail.com', used: false },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(OTP_RECORD);
    });

    it("retourne null si aucun OTP non utilisé n'existe", async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      const result = await repository.findValidOtp('aliou@gmail.com');

      expect(result).toBeNull();
    });
  });

  describe('createOtp', () => {
    it('crée un enregistrement OTP avec les données fournies', async () => {
      prisma.otpCode.create.mockResolvedValue(OTP_RECORD);

      const data = {
        email: 'aliou@gmail.com',
        code: '123456',
        expiresAt: new Date('2026-06-25T10:10:00'),
      };

      const result = await repository.createOtp(data);

      expect(prisma.otpCode.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(OTP_RECORD);
    });
  });

  describe('markOtpUsed', () => {
    it('marque l’OTP comme utilisé', async () => {
      prisma.otpCode.update.mockResolvedValue({ ...OTP_RECORD, used: true });

      const result = await repository.markOtpUsed('otp-1');

      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { used: true },
      });
      expect(result.used).toBe(true);
    });
  });

  describe('invalidatePreviousOtps', () => {
    it('marque tous les OTPs non utilisés de cet email comme utilisés', async () => {
      prisma.otpCode.updateMany.mockResolvedValue({ count: 2 });

      const result = await repository.invalidatePreviousOtps('aliou@gmail.com');

      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
        where: { email: 'aliou@gmail.com', used: false },
        data: { used: true },
      });
      expect(result).toEqual({ count: 2 });
    });

    it("retourne count: 0 si aucun OTP n'était à invalider", async () => {
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });

      const result =
        await repository.invalidatePreviousOtps('personne@gmail.com');

      expect(result).toEqual({ count: 0 });
    });
  });
});

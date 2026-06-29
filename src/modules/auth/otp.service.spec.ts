import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpRepository } from './otp.repository';
import {
  generateOtpCode,
  getOtpExpiry,
  isOtpValid,
} from '@/common/utils/otp.utils';

jest.mock('@/common/utils/otp.utils', () => ({
  generateOtpCode: jest.fn(),
  getOtpExpiry: jest.fn(),
  isOtpValid: jest.fn(),
}));

const mockedGenerateOtpCode = generateOtpCode as jest.MockedFunction<
  typeof generateOtpCode
>;
const mockedGetOtpExpiry = getOtpExpiry as jest.MockedFunction<
  typeof getOtpExpiry
>;
const mockedIsOtpValid = isOtpValid as jest.MockedFunction<typeof isOtpValid>;

const createMockOtpRepository = () => ({
  findValidOtp: jest.fn(),
  createOtp: jest.fn(),
  markOtpUsed: jest.fn(),
  invalidatePreviousOtps: jest.fn(),
});

const OTP_RECORD = {
  id: 'otp-1',
  email: 'aliou@gmail.com',
  code: '123456',
  expiresAt: new Date('2026-06-25T10:10:00'),
  used: false,
  createdAt: new Date('2026-06-25T10:00:00'),
};

describe('OtpService', () => {
  let service: OtpService;
  let otpRepository: ReturnType<typeof createMockOtpRepository>;

  beforeEach(async () => {
    otpRepository = createMockOtpRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: OtpRepository, useValue: otpRepository },
      ],
    }).compile();

    service = module.get(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    beforeEach(() => {
      otpRepository.invalidatePreviousOtps.mockResolvedValue({ count: 1 });
      mockedGenerateOtpCode.mockReturnValue('654321');
      mockedGetOtpExpiry.mockReturnValue(new Date('2026-06-25T10:10:00'));
      otpRepository.createOtp.mockResolvedValue(OTP_RECORD);
    });

    it('invalide les anciens OTPs, génère et enregistre un nouveau code', async () => {
      const result = await service.send('aliou@gmail.com');

      expect(otpRepository.invalidatePreviousOtps).toHaveBeenCalledWith(
        'aliou@gmail.com',
      );
      expect(mockedGetOtpExpiry).toHaveBeenCalledWith(10);
      expect(otpRepository.createOtp).toHaveBeenCalledWith({
        email: 'aliou@gmail.com',
        code: '654321',
        expiresAt: new Date('2026-06-25T10:10:00'),
      });
      expect(result).toBe('654321');
    });

    it("invalide les OTPs précédents avant d'en créer un nouveau (ordre des appels)", async () => {
      const callOrder: string[] = [];
      otpRepository.invalidatePreviousOtps.mockImplementation(() => {
        callOrder.push('invalidate');
        return { count: 1 };
      });
      otpRepository.createOtp.mockImplementation(() => {
        callOrder.push('create');
        return OTP_RECORD;
      });

      await service.send('aliou@gmail.com');

      expect(callOrder).toEqual(['invalidate', 'create']);
    });
  });

  describe('verifyAndConsume', () => {
    it('marque le code comme utilisé si le code est valide et correct', async () => {
      otpRepository.findValidOtp.mockResolvedValue(OTP_RECORD);
      mockedIsOtpValid.mockReturnValue(true);
      otpRepository.markOtpUsed.mockResolvedValue({
        ...OTP_RECORD,
        used: true,
      });

      await service.verifyAndConsume('aliou@gmail.com', '123456');

      expect(otpRepository.findValidOtp).toHaveBeenCalledWith(
        'aliou@gmail.com',
      );
      expect(mockedIsOtpValid).toHaveBeenCalledWith(OTP_RECORD);
      expect(otpRepository.markOtpUsed).toHaveBeenCalledWith(OTP_RECORD.id);
    });

    it("lève BadRequestException si aucun OTP valide n'existe (isOtpValid retourne false)", async () => {
      otpRepository.findValidOtp.mockResolvedValue(null);
      mockedIsOtpValid.mockReturnValue(false);

      await expect(
        service.verifyAndConsume('aliou@gmail.com', '123456'),
      ).rejects.toThrow(BadRequestException);
      expect(otpRepository.markOtpUsed).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si le code fourni ne correspond pas', async () => {
      otpRepository.findValidOtp.mockResolvedValue(OTP_RECORD);
      mockedIsOtpValid.mockReturnValue(true);

      await expect(
        service.verifyAndConsume('aliou@gmail.com', '000000'),
      ).rejects.toThrow(BadRequestException);
      expect(otpRepository.markOtpUsed).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si l'OTP est expiré (isOtpValid retourne false malgré un record)", async () => {
      otpRepository.findValidOtp.mockResolvedValue({
        ...OTP_RECORD,
        expiresAt: new Date('2020-01-01'),
      });
      mockedIsOtpValid.mockReturnValue(false);

      await expect(
        service.verifyAndConsume('aliou@gmail.com', '123456'),
      ).rejects.toThrow(BadRequestException);
      expect(otpRepository.markOtpUsed).not.toHaveBeenCalled();
    });
  });
});

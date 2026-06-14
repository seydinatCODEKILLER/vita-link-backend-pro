import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { OtpRepository } from './otp.repository';
import {
  generateOtpCode,
  getOtpExpiry,
  isOtpValid,
} from '@/common/utils/otp.utils';

@Injectable()
export class OtpService {
  constructor(private readonly otpRepository: OtpRepository) {}

  async send(email: string): Promise<string> {
    await this.otpRepository.invalidatePreviousOtps(email);
    const code = generateOtpCode();
    const expiresAt = getOtpExpiry(10);
    await this.otpRepository.createOtp({ email, code, expiresAt });
    return code;
  }

  async verifyAndConsume(email: string, code: string): Promise<void> {
    const record = await this.otpRepository.findValidOtp(email);
    if (!isOtpValid(record)) {
      throw new BadRequestException('Code OTP invalide ou expiré');
    }
    if (record!.code !== code) {
      throw new BadRequestException('Code OTP incorrect');
    }
    await this.otpRepository.markOtpUsed(record!.id);
  }
}

import { OtpCode } from '@/generated/prisma/client';
import crypto from 'crypto';

export const generateOtpCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

export const getOtpExpiry = (minutes = 10): Date => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

export const isOtpValid = (otpRecord: OtpCode | null): boolean => {
  if (!otpRecord) return false;
  if (otpRecord.used) return false;
  if (new Date() > new Date(otpRecord.expiresAt)) return false;
  return true;
};

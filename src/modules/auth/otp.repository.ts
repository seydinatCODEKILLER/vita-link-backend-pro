import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class OtpRepository extends BaseRepository<PrismaService['otpCode']> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.otpCode);
  }

  findValidOtp(email: string) {
    return this.model.findFirst({
      where: { email, used: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  createOtp(data: { email: string; code: string; expiresAt: Date }) {
    return this.model.create({ data });
  }

  markOtpUsed(id: string) {
    return this.model.update({
      where: { id },
      data: { used: true },
    });
  }

  invalidatePreviousOtps(email: string) {
    return this.model.updateMany({
      where: { email, used: false },
      data: { used: true },
    });
  }
}

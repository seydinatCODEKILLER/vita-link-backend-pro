import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TokenExpireJob {
  private readonly logger = new Logger(TokenExpireJob.name);

  constructor(private readonly prisma: PrismaService) {}

  // Tous les jours à 03h00 — nettoie les tokens et OTP expirés
  @Cron('0 3 * * *')
  async run(): Promise<void> {
    try {
      const now = new Date();

      const [deletedOtps, revokedTokens] = await Promise.all([
        this.prisma.otpCode.deleteMany({
          where: { expiresAt: { lte: now } },
        }),
        this.prisma.user.updateMany({
          where: { refreshTokenExpiresAt: { lte: now, not: null } },
          data: { refreshToken: null, refreshTokenExpiresAt: null },
        }),
      ]);

      const totalCleaned = deletedOtps.count + revokedTokens.count;

      if (totalCleaned > 0) {
        this.logger.log(
          `CRON_TOKENS_CLEANED — expiredOtps: ${deletedOtps.count} — revokedRefreshTokens: ${revokedTokens.count}`,
        );
      }
    } catch (err) {
      this.logger.error('Erreur CRON tokenExpire', err);
    }
  }
}

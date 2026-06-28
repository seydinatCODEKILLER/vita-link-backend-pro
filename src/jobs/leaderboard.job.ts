import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class LeaderboardJob {
  private readonly logger = new Logger(LeaderboardJob.name);

  constructor(private readonly prisma: PrismaService) {}

  // Le 1er de chaque mois à 09h00 — snapshot du classement (et éventuelle
  // remise de prix aux gagnants)
  @Cron('0 9 1 * *')
  async run(): Promise<void> {
    try {
      const topDonors = await this.prisma.jambaarsProfile.findMany({
        where: { donationCount: { gt: 0 } },
        take: 3,
        orderBy: [{ totalPoints: 'desc' }],
        select: {
          totalPoints: true,
          user: { select: { firstName: true, lastName: true } },
        },
      });

      this.logger.log(
        `CRON_LEADERBOARD_SNAPSHOT — top: ${topDonors
          .map((d) => `${d.user.firstName} (${d.totalPoints} pts)`)
          .join(', ')}`,
      );

      // TODO : déclencher l'envoi d'emails via Brevo aux gagnants du mois
      // (@nestjs-modules/mailer + @getbrevo/brevo sont déjà en dépendance)
    } catch (err) {
      this.logger.error('Erreur CRON leaderboard', err);
    }
  }
}

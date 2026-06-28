import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertStatus } from '@/generated/prisma/enums';

@Injectable()
export class AlertExpiryJob {
  private readonly logger = new Logger(AlertExpiryJob.name);

  constructor(private readonly prisma: PrismaService) {}

  // Toutes les 5 minutes — ferme les alertes expirées
  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      const now = new Date();

      // Comparer quantityConfirmed à quantityNeeded (deux colonnes du même
      // enregistrement) n'est pas supporté nativement par Prisma Client
      // sans la preview feature `fieldReference` (et `prisma.alert.fields`
      // dans le code Express d'origine n'est de toute façon pas une API
      // valide pour un `where` standard). On lit donc les alertes actives
      // expirées en une requête, puis on répartit en mémoire — plus sûr
      // et portable, sans dépendre d'une preview feature.
      const expiredActiveAlerts = await this.prisma.alert.findMany({
        where: { status: AlertStatus.ACTIVE, expiresAt: { lte: now } },
        select: { id: true, quantityNeeded: true, quantityConfirmed: true },
      });

      if (expiredActiveAlerts.length === 0) return;

      const quotaReachedIds = expiredActiveAlerts
        .filter((a) => a.quantityConfirmed >= a.quantityNeeded)
        .map((a) => a.id);
      const expiredIds = expiredActiveAlerts
        .filter((a) => a.quantityConfirmed < a.quantityNeeded)
        .map((a) => a.id);

      const [quotaReached, expired] = await Promise.all([
        quotaReachedIds.length > 0
          ? this.prisma.alert.updateMany({
              where: { id: { in: quotaReachedIds } },
              data: { status: AlertStatus.QUOTA_REACHED, closedAt: now },
            })
          : Promise.resolve({ count: 0 }),
        expiredIds.length > 0
          ? this.prisma.alert.updateMany({
              where: { id: { in: expiredIds } },
              data: { status: AlertStatus.EXPIRED },
            })
          : Promise.resolve({ count: 0 }),
      ]);

      const totalAffected = quotaReached.count + expired.count;
      if (totalAffected > 0) {
        this.logger.log(
          `CRON_ALERTS_EXPIRED — quotaReached: ${quotaReached.count} — expired: ${expired.count}`,
        );
      }
    } catch (err) {
      this.logger.error('Erreur CRON alertExpiry', err);
    }
  }
}

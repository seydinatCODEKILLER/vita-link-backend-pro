import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsService } from '@/events/events.service';
import { PurchaseOrderStatus } from '@/generated/prisma/enums';

@Injectable()
export class PurchaseOrderExpiryJob {
  private readonly logger = new Logger(PurchaseOrderExpiryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  // Toutes les 10 minutes — vérifie les bons de commande expirés
  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    try {
      const now = new Date();

      const expiredOrders = await this.prisma.purchaseOrder.findMany({
        where: { status: PurchaseOrderStatus.PENDING, expiresAt: { lte: now } },
        select: {
          id: true,
          code: true,
          cntsId: true,
          hospitalId: true,
          bloodType: true,
          quantity: true,
        },
      });

      if (expiredOrders.length === 0) return;

      const result = await this.prisma.purchaseOrder.updateMany({
        where: { id: { in: expiredOrders.map((o) => o.id) } },
        data: { status: PurchaseOrderStatus.EXPIRED },
      });

      // Notifier la CNTS pour chaque bon expiré (pour qu'elle confirme
      // manuellement si le sang a réellement été remis ou non).
      for (const order of expiredOrders) {
        this.events.emitToStructure(
          order.cntsId,
          'purchase_order:expired_confirm_required',
          {
            orderId: order.id,
            code: order.code,
            bloodType: order.bloodType,
            quantity: order.quantity,
            hospitalId: order.hospitalId,
            message: `Le bon ${order.code} a expiré. Veuillez confirmer si le sang a été remis.`,
          },
        );
      }

      this.logger.log(`CRON_PURCHASE_ORDERS_EXPIRED — count: ${result.count}`);
    } catch (err) {
      this.logger.error('Erreur CRON purchaseOrderExpiry', err);
    }
  }
}

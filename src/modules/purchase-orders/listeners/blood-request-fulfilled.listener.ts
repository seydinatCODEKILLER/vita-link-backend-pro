import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BloodRequestHandledEvent } from '@/modules/blood-requests/events/blood-request-handled.event';
import { PurchaseOrdersService } from '../purchase-orders.service';

@Injectable()
export class BloodRequestFulfilledListener {
  private readonly logger = new Logger(BloodRequestFulfilledListener.name);

  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @OnEvent('blood_request.fulfilled', { async: true })
  async handle(event: BloodRequestHandledEvent): Promise<void> {
    try {
      await this.purchaseOrdersService.createForRequest({
        bloodRequestId: event.requestId,
        cntsId: event.cntsId,
        hospitalId: event.hospitalId,
        bloodType: event.bloodType,
        quantity: event.quantityProvided,
      });
    } catch (err) {
      this.logger.error(
        `Erreur création bon de commande — requestId: ${event.requestId}`,
        err,
      );
    }
  }

  @OnEvent('blood_request.handled', { async: true })
  async handlePartial(event: BloodRequestHandledEvent): Promise<void> {
    if (event.action !== 'PARTIALLY_FULFILL') return;

    try {
      await this.purchaseOrdersService.createForRequest({
        bloodRequestId: event.requestId,
        cntsId: event.cntsId,
        hospitalId: event.hospitalId,
        bloodType: event.bloodType,
        quantity: event.quantityProvided,
      });
    } catch (err) {
      this.logger.error(
        `Erreur création bon partiel — requestId: ${event.requestId}`,
        err,
      );
    }
  }
}

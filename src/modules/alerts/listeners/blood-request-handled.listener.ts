import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BloodRequestHandledEvent } from '@/modules/blood-requests/events/blood-request-handled.event';
import { AlertsService } from '../alerts.service';
import { BloodRequestsRepository } from '@/modules/blood-requests/blood-requests.repository';
import { AlertOrigin, BloodRequestStatus } from '@/generated/prisma/enums';

@Injectable()
export class BloodRequestHandledListener {
  private readonly logger = new Logger(BloodRequestHandledListener.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly bloodRequestsRepository: BloodRequestsRepository,
  ) {}

  @OnEvent('blood_request.handled', { async: true })
  async handleEscalation(event: BloodRequestHandledEvent): Promise<void> {
    if (event.action !== 'PARTIALLY_FULFILL' && event.action !== 'ESCALATE') {
      return;
    }

    const quantityForAlert =
      event.action === 'ESCALATE'
        ? event.quantityNeeded
        : event.quantityNeeded - event.quantityProvided;

    try {
      const { alert } = await this.alertsService.createAlert(
        {
          bloodType: event.bloodType,
          quantityNeeded: quantityForAlert,
          urgencyLevel: event.urgencyLevel,
          serviceUnit: event.serviceUnit,
          origin: AlertOrigin.CNTS_ESCALATION,
          bloodRequestId: event.requestId,
          radiusKm: event.radiusKm,
        },
        event.agentUser as Parameters<AlertsService['createAlert']>[1],
      );

      await this.bloodRequestsRepository.updateStatus(event.requestId, {
        status:
          event.action === 'ESCALATE'
            ? BloodRequestStatus.ESCALATED_TO_ALERT
            : BloodRequestStatus.PARTIALLY_FULFILLED,
        escalatedAlertId: alert.id,
      });

      this.logger.log(
        `ALERT_CREATED_FROM_REQUEST — alertId: ${alert.id} — requestId: ${event.requestId}`,
      );
    } catch (err) {
      this.logger.error(
        `Erreur création alerte depuis demande — requestId: ${event.requestId}`,
        err,
      );
    }
  }

  @OnEvent('blood_request.fulfilled', { async: true })
  handleFulfill(event: BloodRequestHandledEvent): void {
    this.logger.log(
      `BLOOD_REQUEST_FULFILLED_EVENT — requestId: ${event.requestId}`,
    );
  }
}

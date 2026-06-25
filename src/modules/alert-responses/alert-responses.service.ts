import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AlertResponsesRepository } from './alert-responses.repository';
import { AlertsService } from '../alerts/alerts.service';
import { EventsService } from '@/events/events.service';
import { ConfirmResponseDto } from './dto/confirm-response.dto';
import { generateDonationQr } from '@/common/utils/qr.utils';
import { isDonorEligible } from '@/common/utils/points.utils';
import { AlertResponseStatus, AlertStatus } from '@/generated/prisma/enums';

@Injectable()
export class AlertResponsesService {
  private readonly logger = new Logger(AlertResponsesService.name);

  constructor(
    private readonly repository: AlertResponsesRepository,
    private readonly events: EventsService,
    private readonly alertsService: AlertsService,
  ) {}

  async confirm(alertId: string, donorId: string, dto: ConfirmResponseDto) {
    const alert = await this.repository.findActiveAlert(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable ou expirée');

    const activeConfirmations =
      await this.repository.findActiveConfirmationsForDonor(donorId);
    if (activeConfirmations.length > 0) {
      throw new BadRequestException(
        'Vous avez déjà confirmé votre venue pour une autre alerte en cours.',
      );
    }

    const donorProfile = await this.repository.findDonorProfile(donorId);
    if (
      donorProfile?.nextEligibilityAt &&
      !isDonorEligible(donorProfile.nextEligibilityAt)
    ) {
      throw new BadRequestException(
        "Vous n'êtes pas éligible pour donner actuellement (période d'attente en cours)",
      );
    }

    const existing = await this.repository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (existing) {
      throw new BadRequestException('Vous avez déjà répondu à cette alerte');
    }

    const { code: qrCode } = await generateDonationQr();

    const newResponse = await this.repository.createResponse({
      alertId,
      donorId,
      status: AlertResponseStatus.CONFIRMED,
      etaMinutes: dto.etaMinutes ?? null,
      qrCode,
    });

    const updatedAlert = await this.repository.incrementAlertConfirmed(alertId);
    const isQuotaReached =
      updatedAlert.quantityConfirmed >= updatedAlert.quantityNeeded;

    if (isQuotaReached) {
      await this.repository.closeAlert(alertId);
    }

    this.events.emitToAlert(alertId, 'response:new', {
      responseId: newResponse.id,
      status: AlertResponseStatus.CONFIRMED,
      qrCode,
      isQuotaReached,
    });

    this.logger.log(
      `DONOR_CONFIRMED — alertId: ${alertId} — donorId: ${donorId} — quota: ${isQuotaReached}`,
    );

    return {
      message:
        "Confirmation enregistrée. Présentez ce QR Code à l'accueil de l'hôpital.",
      qrCode,
      isQuotaReached,
    };
  }

  async decline(alertId: string, donorId: string) {
    const alert = await this.repository.findActiveAlert(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable ou expirée');

    const existing = await this.repository.findByAlertAndDonor(
      alertId,
      donorId,
    );

    if (existing?.status === AlertResponseStatus.DECLINED) {
      return { message: 'Vous avez déjà signalé votre indisponibilité.' };
    }

    if (existing?.status === AlertResponseStatus.CONFIRMED) {
      throw new BadRequestException(
        "Vous avez déjà confirmé votre venue. Contactez directement l'hôpital.",
      );
    }

    const response = await this.repository.upsertDecline(alertId, donorId);

    this.events.emitToAlert(alertId, 'response:declined', {
      responseId: response.id,
      donorId,
      status: AlertResponseStatus.DECLINED,
    });

    this.logger.log(
      `DONOR_DECLINED — alertId: ${alertId} — donorId: ${donorId}`,
    );

    return { message: 'Votre refus a été pris en compte.' };
  }

  async markArrived(alertId: string, donorId: string) {
    const response = await this.repository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (!response) {
      throw new NotFoundException(
        'Aucune réponse trouvée pour ce donneur sur cette alerte',
      );
    }
    if (response.status !== AlertResponseStatus.CONFIRMED) {
      throw new BadRequestException(
        'Seuls les donneurs ayant confirmé peuvent marquer leur arrivée',
      );
    }

    const now = new Date();
    const etaMinutes =
      response.etaMinutes ??
      (response.respondedAt
        ? Math.floor(
            (now.getTime() - new Date(response.respondedAt).getTime()) / 60000,
          )
        : null);

    await this.repository.updateResponseStatus(response.id, {
      status: AlertResponseStatus.ARRIVED,
      arrivedAt: now,
      ...(etaMinutes !== null && { etaMinutes }),
    });

    this.events.emitToAlert(response.alertId, 'response:arrived', {
      responseId: response.id,
      donorId: response.donorId,
    });

    this.logger.log(
      `DONOR_ARRIVED — responseId: ${response.id} — eta: ${etaMinutes}min`,
    );

    return { message: 'Arrivée confirmée. Scannez le QR Code du donneur.' };
  }

  async markNoShow(alertId: string, donorId: string) {
    const response = await this.repository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (!response) {
      throw new NotFoundException(
        'Aucune réponse trouvée pour ce donneur sur cette alerte',
      );
    }

    if (
      response.status !== AlertResponseStatus.CONFIRMED &&
      response.status !== AlertResponseStatus.ARRIVED
    ) {
      throw new BadRequestException(
        'Seuls les donneurs ayant confirmé peuvent être signalés comme absents',
      );
    }

    await this.repository.updateResponseStatus(response.id, {
      status: AlertResponseStatus.NO_SHOW,
    });

    const updatedAlert =
      await this.alertsService.decrementConfirmedCount(alertId);

    if (updatedAlert.status === AlertStatus.ACTIVE) {
      this.events.emitToStructure(
        updatedAlert.healthStructureId,
        'alert:reactivated',
        {
          alertId: updatedAlert.id,
          quantityConfirmed: updatedAlert.quantityConfirmed,
          quantityNeeded: updatedAlert.quantityNeeded,
          message: "Un donneur ne s'est pas présenté — l'alerte est réactivée",
        },
      );
    }

    this.logger.log(
      `DONOR_NO_SHOW — alertId: ${alertId} — donorId: ${donorId} — statut alerte: ${updatedAlert.status}`,
    );

    return {
      message:
        "Signalement enregistré. Le système va ajuster le quota de l'alerte.",
    };
  }

  async cancelConfirmation(alertId: string, donorId: string) {
    const response = await this.repository.findByAlertAndDonor(
      alertId,
      donorId,
    );
    if (!response) {
      throw new NotFoundException('Aucune réponse trouvée pour cette alerte');
    }
    if (response.status !== AlertResponseStatus.CONFIRMED) {
      throw new BadRequestException('Seule une confirmation peut être annulée');
    }

    await this.repository.updateResponseStatus(response.id, {
      status: AlertResponseStatus.CANCELLED,
    });

    await this.repository.decrementAlertConfirmed(alertId);

    const isReopened = await this.repository.reopenAlertIfNecessary(alertId);

    this.events.emitToAlert(alertId, 'response:cancelled', {
      responseId: response.id,
      donorId,
      status: AlertResponseStatus.CANCELLED,
      isReopened,
    });

    this.logger.log(
      `DONOR_CANCELLED — alertId: ${alertId} — donorId: ${donorId} — réouvert: ${isReopened}`,
    );

    return { message: "Votre venue a été annulée. L'hôpital a été prévenu." };
  }

  async checkActiveConfirmation(donorId: string) {
    const active =
      await this.repository.findActiveConfirmationsForDonor(donorId);
    return { hasActiveConfirmation: active.length > 0 };
  }
}

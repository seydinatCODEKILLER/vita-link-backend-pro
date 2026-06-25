import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  AlertsRepository,
  AlertDetail,
  NearbyDonorRow,
} from './alerts.repository';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { ListNearbyAlertsDto } from './dto/list-nearby-alerts.dto';
import { ListStructureAlertsDto } from './dto/list-structure-alerts.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  AlertOrigin,
  AlertStatus,
  Role,
  StructureType,
} from '@/generated/prisma/enums';

const AUTO_EXPIRY_MINUTES: Record<string, number> = {
  VITAL: 60,
  STANDARD: 240,
};

type Structure = NonNullable<AuthenticatedUser['employerStructure']>;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly repository: AlertsRepository,
    private readonly events: EventsService,
    private readonly push: PushService,
  ) {}

  async createAlert(dto: CreateAlertDto, user: AuthenticatedUser) {
    const structure = this.validateStructure(user);
    const { alertLat, alertLng } = this.resolveCoordinates(dto, structure);
    const expiresAt = this.computeExpiry(dto);
    const origin = this.resolveOrigin(dto, structure);

    const alert = await this.repository.createAlert({
      bloodType: dto.bloodType,
      quantityNeeded: dto.quantityNeeded,
      urgencyLevel: dto.urgencyLevel,
      serviceUnit: dto.serviceUnit,
      radiusKm: dto.radiusKm,
      address: dto.address ?? structure.address,
      latitude: alertLat,
      longitude: alertLng,
      expiresAt,
      healthStructureId: user.healthStructureId!,
      createdByUserId: user.id,
      origin,
      bloodRequestId: dto.bloodRequestId ?? null,
    });

    const nearbyDonors = await this.repository.findNearbyDonors(
      alertLat,
      alertLng,
      dto.radiusKm ?? 10,
      dto.bloodType,
    );

    this.logger.log(
      `ALERT_CREATED — ${alert.id} — ${dto.bloodType} — ${nearbyDonors.length} donneurs`,
    );

    this.notifyDonors(alert, nearbyDonors, dto);
    this.escalateToCnts(alert, origin, structure, dto);

    return { alert, notifiedDonors: nearbyDonors.length };
  }

  // ── Méthodes privées ───────────────────────────────────────

  private validateStructure(user: AuthenticatedUser): Structure {
    const structure = user.employerStructure;
    if (!structure?.isVerified) {
      throw new ForbiddenException(
        'Votre structure doit être vérifiée avant de pouvoir émettre des alertes',
      );
    }
    return structure;
  }

  private resolveCoordinates(dto: CreateAlertDto, structure: Structure) {
    const alertLat = dto.latitude ?? structure.latitude;
    const alertLng = dto.longitude ?? structure.longitude;

    if (!alertLat || !alertLng) {
      throw new BadRequestException(
        'Coordonnées géographiques requises. Mettez à jour la localisation de votre structure.',
      );
    }

    return { alertLat, alertLng };
  }

  private computeExpiry(dto: CreateAlertDto): Date {
    if (dto.expiresAt) return new Date(dto.expiresAt);
    const minutes = AUTO_EXPIRY_MINUTES[dto.urgencyLevel] ?? 240;
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private resolveOrigin(
    dto: CreateAlertDto,
    structure: Structure,
  ): AlertOrigin {
    return (
      dto.origin ??
      (structure.structureType === StructureType.CNTS
        ? AlertOrigin.CNTS_DIRECT
        : AlertOrigin.HOSPITAL_DIRECT)
    );
  }

  private notifyDonors(
    alert: AlertDetail,
    donors: NearbyDonorRow[],
    dto: CreateAlertDto,
  ): void {
    const payload = {
      alertId: alert.id,
      bloodType: alert.bloodType,
      urgencyLevel: alert.urgencyLevel,
      serviceUnit: alert.serviceUnit,
      structureName: alert.healthStructure.name,
      address: alert.address,
      latitude: alert.latitude,
      longitude: alert.longitude,
      quantityNeeded: alert.quantityNeeded,
      expiresAt: alert.expiresAt,
    };

    donors.forEach((donor) =>
      this.events.emitToUser(donor.id, 'alert:new', payload),
    );

    const tokens = donors
      .map((d) => d.expoPushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) return;

    this.push
      .sendMulticast({
        tokens,
        title:
          dto.urgencyLevel === 'VITAL'
            ? '🚨 URGENCE VITALE — Don de sang requis !'
            : '🩸 Besoin de sang dans votre zone',
        body: `Groupe ${dto.bloodType.replace('_', ' ')} — ${alert.healthStructure.name}. Pouvez-vous venir ?`,
        data: { type: 'ALERT_NEW', alertId: alert.id },
      })
      .catch((err) =>
        this.logger.error(`Erreur push multicast — ${alert.id}`, err),
      );
  }

  private escalateToCnts(
    alert: AlertDetail,
    origin: AlertOrigin,
    structure: Structure,
    dto: CreateAlertDto,
  ): void {
    if (origin !== AlertOrigin.HOSPITAL_DIRECT || !structure.affiliatedCntsId) {
      return;
    }

    this.events.emitToStructure(
      structure.affiliatedCntsId,
      'alert:escalation',
      {
        alertId: alert.id,
        bloodType: alert.bloodType,
        urgencyLevel: alert.urgencyLevel,
        quantityNeeded: alert.quantityNeeded,
        hospitalName: structure.name,
        hospitalId: structure.id,
        message: `${structure.name} vient de lancer une alerte ${dto.urgencyLevel === 'VITAL' ? 'VITALE' : 'standard'}`,
      },
    );
  }

  // ── Méthodes publiques ─────────────────────────────────────

  async getNearbyAlerts(dto: ListNearbyAlertsDto, user: AuthenticatedUser) {
    const latitude = dto.lat ?? user.latitude;
    const longitude = dto.lng ?? user.longitude;

    if (!latitude || !longitude) {
      throw new BadRequestException(
        'Coordonnées requises. Activez la géolocalisation ou mettez à jour votre profil.',
      );
    }

    const rawAlerts = await this.repository.findNearbyActive(
      latitude,
      longitude,
      dto.radius ?? 15,
      user.id,
    );

    return rawAlerts.map((a) => ({
      id: a.id,
      bloodType: a.bloodType,
      quantityNeeded: a.quantityNeeded,
      quantityConfirmed: a.quantityConfirmed,
      urgencyLevel: a.urgencyLevel,
      status: a.status,
      serviceUnit: a.serviceUnit,
      address: a.address,
      latitude: a.latitude,
      longitude: a.longitude,
      radiusKm: a.radiusKm,
      expiresAt: a.expiresAt,
      createdAt: a.createdAt,
      distance_km: Math.round(a.distance_km * 10) / 10,
      healthStructure: {
        id: a.structureId,
        name: a.structureName,
        address: a.structureAddress,
        latitude: a.structureLatitude,
        longitude: a.structureLongitude,
      },
    }));
  }

  async getAlertById(alertId: string) {
    const alert = await this.repository.findByIdWithDetails(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable');
    return alert;
  }

  async getMyStructureAlerts(
    user: AuthenticatedUser,
    dto: ListStructureAlertsDto,
  ) {
    if (!user.healthStructureId) {
      throw new ForbiddenException("Vous n'êtes rattaché à aucune structure");
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { data, total } = await this.repository.findByStructure(
      user.healthStructureId,
      { page, limit, status: dto.status },
    );

    return {
      alerts: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAlertResponses(alertId: string, user: AuthenticatedUser) {
    const alert = await this.repository.findByIdWithDetails(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable');

    if (
      user.role !== Role.ADMIN &&
      alert.healthStructure.id !== user.healthStructureId
    ) {
      throw new ForbiddenException('Accès refusé à cette alerte');
    }

    const responses = await this.repository.findResponses(alertId);

    const summary = {
      confirmed: responses.filter((r) => r.status === 'CONFIRMED').length,
      arrived: responses.filter((r) => r.status === 'ARRIVED').length,
      declined: responses.filter((r) => r.status === 'DECLINED').length,
      noShow: responses.filter((r) => r.status === 'NO_SHOW').length,
    };

    return { alert, responses, summary };
  }

  async closeAlert(alertId: string, user: AuthenticatedUser) {
    const alert = await this.repository.findByIdWithDetails(alertId);
    if (!alert) throw new NotFoundException('Alerte introuvable');

    if (
      user.role !== Role.ADMIN &&
      alert.healthStructure.id !== user.healthStructureId
    ) {
      throw new ForbiddenException('Vous ne pouvez pas fermer cette alerte');
    }

    if (alert.status !== AlertStatus.ACTIVE) {
      throw new BadRequestException(
        `Cette alerte ne peut pas être fermée (statut actuel : ${alert.status})`,
      );
    }

    const closed = await this.repository.closeAlert(alertId);

    this.events.emitToAlert(alertId, 'alert:closed', {
      alertId,
      status: 'CANCELLED',
      closedAt: closed.closedAt,
    });

    this.events.emitToStructure(user.healthStructureId!, 'alert:closed', {
      alertId,
      status: 'CANCELLED',
    });

    this.logger.log(`ALERT_CLOSED — ${alertId} — par ${user.id}`);

    return closed;
  }

  async incrementConfirmedCount(alertId: string) {
    return this.repository.incrementConfirmed(alertId);
  }

  async decrementConfirmedCount(alertId: string) {
    return this.repository.decrementConfirmed(alertId);
  }
}

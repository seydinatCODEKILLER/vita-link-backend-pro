import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DonationsRepository } from './donations.repository';
import { JambaarsService } from '@/modules/jambaar-profile/jambaar-profile.service';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import { ScanDonationDto } from './dto/scan-donation.dto';
import { ListDonationsDto } from './dto/list-donations.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { Role, StructureType } from '@/generated/prisma/enums';
import {
  calculateDonationPoints,
  calculateGrade,
  calculateNextEligibility,
} from '@/common/utils/points.utils';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    private readonly repository: DonationsRepository,
    private readonly jambaarsService: JambaarsService,
    private readonly events: EventsService,
    private readonly push: PushService,
  ) {}

  async scanAndValidate(dto: ScanDonationDto, agent: AuthenticatedUser) {
    const alertResponse = await this.repository.findAlertResponseByQrCode(
      dto.qrCode,
    );
    if (!alertResponse) {
      throw new NotFoundException('QR Code invalide ou introuvable');
    }
    if (alertResponse.donation) {
      throw new BadRequestException(
        'Ce QR Code a déjà été utilisé pour valider un don',
      );
    }
    if (['DECLINED', 'NO_SHOW'].includes(alertResponse.status)) {
      throw new BadRequestException(
        "Ce donneur n'a pas confirmé sa venue pour cette alerte",
      );
    }
    if (
      agent.role !== Role.ADMIN &&
      alertResponse.alert.healthStructureId !== agent.healthStructureId
    ) {
      throw new ForbiddenException(
        'Ce QR Code appartient à une autre structure de santé',
      );
    }

    const { donor, alert } = alertResponse;

    const pointsAwarded = calculateDonationPoints({
      urgencyLevel: alert.urgencyLevel,
      bloodType: alert.bloodType,
      etaMinutes: alertResponse.etaMinutes ?? undefined,
    });

    const currentPoints = donor.jambaarsProfile?.totalPoints ?? 0;
    const newTotalPoints = currentPoints + pointsAwarded;
    const newGrade = calculateGrade(newTotalPoints);
    const gradeChanged =
      newGrade !== (donor.jambaarsProfile?.currentGrade ?? 'ASPIRANT');

    const nextEligibilityAt = calculateNextEligibility(donor.gender ?? 'MALE');

    let stockStructureId = agent.healthStructureId!;

    if (agent.employerStructure?.structureType !== StructureType.CNTS) {
      const structure = await this.repository.findStructureById(
        agent.healthStructureId!,
      );
      if (structure?.affiliatedCntsId) {
        stockStructureId = structure.affiliatedCntsId;
      } else {
        this.logger.warn(
          `Hôpital ${agent.healthStructureId} sans CNTS affiliée — stock non incrémenté globalement`,
        );
      }
    }

    const donation = await this.repository.validateDonation({
      alertResponseId: alertResponse.id,
      donorId: donor.id,
      healthStructureId: alert.healthStructureId,
      stockStructureId,
      validatedByUserId: agent.id,
      bloodType: alert.bloodType,
      pointsAwarded,
      newGrade,
      nextEligibilityAt,
      notes: dto.notes,
      testResultsJson: dto.testResultsJson,
    });

    this.logger.log(
      `DONATION_VALIDATED — ${donation.id} — donorId: ${donor.id} — pts: ${pointsAwarded}`,
    );

    this.events.emitToUser(donor.id, 'donation:validated', {
      donationId: donation.id,
      pointsAwarded,
      newGrade,
      gradeChanged,
      totalPoints: newTotalPoints,
      nextEligibilityAt,
      updatedJambaarProfile: donation.donor.jambaarsProfile,
    });

    this.events.emitToStructure(stockStructureId, 'stock:updated', {
      bloodType: alert.bloodType,
      increment: 1,
    });

    this.events.emitToAlert(alert.id, 'response:arrived', {
      alertResponseId: alertResponse.id,
      donorId: donor.id,
      donationId: donation.id,
    });

    this._sendDonorPush(donor.id, {
      pointsAwarded,
      gradeChanged,
      newGrade,
    }).catch((err) =>
      this.logger.error(`Push donation failed — ${donor.id}`, err),
    );

    this.jambaarsService
      .processBadgesAfterDonation(donor.id)
      .catch((err) =>
        this.logger.error(`Badges post-donation failed — ${donor.id}`, err),
      );

    return {
      message: 'Don validé avec succès. Points Jambaar crédités.',
      donation,
      jambaar: {
        pointsAwarded,
        newTotalPoints,
        newGrade,
        gradeChanged,
        nextEligibilityAt,
      },
    };
  }

  async getMyDonations(donorId: string, dto: ListDonationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { data, total } = await this.repository.findMyDonations(donorId, {
      page,
      limit,
    });
    return {
      donations: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDonationById(donationId: string, user: AuthenticatedUser) {
    const donation = await this.repository.findDonationById(donationId);
    if (!donation) throw new NotFoundException('Don introuvable');

    if (user.role === Role.DONOR && donation.donor.id !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return donation;
  }

  async getStructureDonations(user: AuthenticatedUser, dto: ListDonationsDto) {
    if (!user.healthStructureId) {
      throw new ForbiddenException("Vous n'êtes rattaché à aucune structure");
    }
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const { data, total } = await this.repository.findStructureDonations(
      user.healthStructureId,
      { page, limit },
    );
    return {
      donations: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async _sendDonorPush(
    donorId: string,
    params: { pointsAwarded: number; gradeChanged: boolean; newGrade: string },
  ): Promise<void> {
    const user = await this.repository.findUserPushToken(donorId);
    if (!user?.expoPushToken) return;

    await this.push.sendToOne({
      token: user.expoPushToken,
      title: params.gradeChanged
        ? `🏅 Nouveau grade : ${params.newGrade} !`
        : '🩸 Don validé — Merci Jambaar !',
      body: params.gradeChanged
        ? `Félicitations ! Vous êtes maintenant ${params.newGrade}. +${params.pointsAwarded} pts`
        : `+${params.pointsAwarded} points Jambaar crédités sur votre profil.`,
      data: {
        type: 'DONATION_VALIDATED',
        pointsAwarded: params.pointsAwarded,
        newGrade: params.newGrade,
      },
    });
  }
}

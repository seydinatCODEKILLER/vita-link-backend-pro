import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BloodRequestsRepository } from './blood-requests.repository';
import { EventsService } from '@/events/events.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { HandleBloodRequestDto } from './dto/handle-blood-request.dto';
import { ListBloodRequestsDto } from './dto/list-blood-requests.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  BloodRequestStatus,
  Role,
  ServiceUnit,
  StructureType,
} from '@/generated/prisma/enums';
import { BloodRequestHandledEvent } from './events/blood-request-handled.event';

@Injectable()
export class BloodRequestsService {
  private readonly logger = new Logger(BloodRequestsService.name);

  constructor(
    private readonly repository: BloodRequestsRepository,
    private readonly events: EventsService,
    private readonly emitter: EventEmitter2,
  ) {}

  // ── POST /blood-requests ───────────────────────────────────

  async createRequest(dto: CreateBloodRequestDto, user: AuthenticatedUser) {
    const hospital = await this.repository.findHospitalStructureById(
      user.healthStructureId!,
    );

    if (!hospital) throw new NotFoundException('Structure introuvable');

    if (hospital.structureType === StructureType.CNTS) {
      throw new ForbiddenException(
        'Une CNTS ne peut pas faire de demande de sang — elle en gère le stock',
      );
    }

    if (!hospital.affiliatedCntsId) {
      throw new BadRequestException(
        "Votre structure n'est affiliée à aucune CNTS. Contactez l'administrateur.",
      );
    }

    const request = await this.repository.createRequest({
      requestingHospitalId: user.healthStructureId!,
      requestedByUserId: user.id,
      handledByCntsId: hospital.affiliatedCntsId,
      bloodType: dto.bloodType,
      quantityNeeded: dto.quantityNeeded,
      urgencyLevel: dto.urgencyLevel,
      serviceUnit: dto.serviceUnit ?? ServiceUnit.GENERAL,
      clinicalContext: dto.clinicalContext,
    });

    this.events.emitToStructure(
      hospital.affiliatedCntsId,
      'blood_request:new',
      {
        requestId: request.id,
        bloodType: request.bloodType,
        quantityNeeded: request.quantityNeeded,
        urgencyLevel: request.urgencyLevel,
        hospitalName: hospital.name,
      },
    );

    this.logger.log(
      `BLOOD_REQUEST_CREATED — ${request.id} — hôpital: ${user.healthStructureId} — cnts: ${hospital.affiliatedCntsId}`,
    );

    return request;
  }

  // ── POST /blood-requests/:id/handle ────────────────────────

  async handleRequest(
    requestId: string,
    dto: HandleBloodRequestDto,
    user: AuthenticatedUser,
  ) {
    const request = await this.repository.findRequestById(requestId);
    if (!request) throw new NotFoundException('Demande introuvable');

    if (request.handledByCnts?.id !== user.healthStructureId) {
      throw new ForbiddenException(
        'Vous ne pouvez traiter que les demandes adressées à votre CNTS',
      );
    }

    if (request.status !== BloodRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cette demande ne peut plus être traitée (statut : ${request.status})`,
      );
    }

    const stock = await this.repository.findStockByCntsAndType(
      user.healthStructureId,
      request.bloodType,
    );
    const available = stock?.quantity ?? 0;

    if (dto.action === 'FULFILL') {
      return this._handleFulfill(
        requestId,
        request,
        dto,
        user,
        stock,
        available,
      );
    }
    if (dto.action === 'PARTIALLY_FULFILL') {
      return this._handlePartialFulfill(
        requestId,
        request,
        dto,
        user,
        stock,
        available,
      );
    }
    if (dto.action === 'ESCALATE') {
      return this._handleEscalate(requestId, request, dto, user);
    }
    if (dto.action === 'REJECT') {
      return this._handleReject(requestId, request, dto, user);
    }

    // Inatteignable en pratique : les 4 valeurs de BloodRequestAction sont
    // exhaustivement couvertes ci-dessus, donc TS narrowe dto.action à
    // `never` ici. On caste en string pour l'interpolation — garde
    // défensive conservée au cas où la validation serait contournée.
    throw new BadRequestException(`Action invalide : ${dto.action as string}`);
  }

  // ── GET /blood-requests ────────────────────────────────────

  async getRequests(user: AuthenticatedUser, dto: ListBloodRequestsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filters = { page, limit, status: dto.status };

    const isCnts = user.employerStructure?.structureType === StructureType.CNTS;

    const { data, total } = isCnts
      ? await this.repository.findByCnts(user.healthStructureId!, filters)
      : await this.repository.findByHospital(user.healthStructureId!, filters);

    return {
      requests: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── GET /blood-requests/:id ────────────────────────────────

  async getById(requestId: string, user: AuthenticatedUser) {
    const request = await this.repository.findRequestById(requestId);
    if (!request) throw new NotFoundException('Demande introuvable');

    const isOwner =
      request.requestingHospital?.id === user.healthStructureId ||
      request.handledByCnts?.id === user.healthStructureId;

    if (user.role !== Role.ADMIN && !isOwner) {
      throw new ForbiddenException('Accès refusé à cette demande');
    }

    return request;
  }

  // ── PATCH /blood-requests/:id/cancel ──────────────────────

  async cancelRequest(requestId: string, user: AuthenticatedUser) {
    const request = await this.repository.findRequestById(requestId);
    if (!request) throw new NotFoundException('Demande introuvable');

    if (request.requestingHospital?.id !== user.healthStructureId) {
      throw new ForbiddenException("Seul l'hôpital demandeur peut annuler");
    }

    if (request.status !== BloodRequestStatus.PENDING) {
      throw new BadRequestException(
        'Seules les demandes en attente peuvent être annulées',
      );
    }

    return this.repository.updateStatus(requestId, {
      status: BloodRequestStatus.CANCELLED,
    });
  }

  // ── Handlers privés ────────────────────────────────────────

  private async _handleFulfill(
    requestId: string,
    request: Awaited<ReturnType<BloodRequestsRepository['findRequestById']>>,
    dto: HandleBloodRequestDto,
    user: AuthenticatedUser,
    stock: Awaited<
      ReturnType<BloodRequestsRepository['findStockByCntsAndType']>
    >,
    available: number,
  ) {
    if (!stock || available < request!.quantityNeeded) {
      throw new BadRequestException(
        `Stock insuffisant pour fournir toute la demande (Dispo: ${available})`,
      );
    }

    await this.repository.decrementStock(stock.id, request!.quantityNeeded);

    await this.repository.updateStatus(requestId, {
      status: BloodRequestStatus.FULFILLED,
      quantityProvided: request!.quantityNeeded,
      handledByUserId: user.id,
      cntsNotes: dto.cntsNotes ?? null,
      fulfilledAt: new Date(),
    });

    // emitAsync (pas emit) : on ATTEND que BloodRequestFulfilledListener
    // (module PurchaseOrders) ait créé le bon de commande avant de
    // répondre au client, pour que `purchaseOrder` soit garanti présent
    // dans le payload — même raisonnement que pour PARTIALLY_FULFILL et
    // ESCALATE (escalatedAlertId). Sans ça, on retomberait dans le même
    // bug : purchaseOrder ne serait posé qu'après coup, une fois la
    // réponse déjà partie.
    await this.emitter.emitAsync(
      'blood_request.fulfilled',
      new BloodRequestHandledEvent(
        'FULFILL',
        requestId,
        user.healthStructureId!,
        request!.requestingHospital.id,
        request!.bloodType,
        request!.urgencyLevel,
        request!.serviceUnit,
        request!.quantityNeeded,
        request!.quantityNeeded,
        dto.radiusKm ?? 10,
        this._buildAgentUser(user),
      ),
    );

    // Relecture de l'état final (purchaseOrder inclus via BLOOD_REQUEST_SELECT)
    // plutôt que de se fier au retour brut de updateStatus ci-dessus.
    const fulfilled = await this.repository.findRequestById(requestId);

    this.events.emitToStructure(
      request!.requestingHospital.id,
      'blood_request:fulfilled',
      { requestId, quantityProvided: request!.quantityNeeded },
    );

    this.logger.log(
      `BLOOD_REQUEST_FULFILLED — ${requestId} — agent: ${user.id}`,
    );

    return fulfilled;
  }

  private async _handlePartialFulfill(
    requestId: string,
    request: Awaited<ReturnType<BloodRequestsRepository['findRequestById']>>,
    dto: HandleBloodRequestDto,
    user: AuthenticatedUser,
    stock: Awaited<
      ReturnType<BloodRequestsRepository['findStockByCntsAndType']>
    >,
    available: number,
  ) {
    const qty = dto.quantityProvided!;

    if (!stock || available < qty) {
      throw new BadRequestException(
        `Stock insuffisant pour fournir ${qty} poches (Dispo: ${available})`,
      );
    }

    await this.repository.decrementStock(stock.id, qty);

    await this.repository.updateStatus(requestId, {
      status: BloodRequestStatus.PARTIALLY_FULFILLED,
      quantityProvided: qty,
      handledByUserId: user.id,
      cntsNotes: dto.cntsNotes ?? null,
    });

    // emitAsync (pas emit) : on ATTEND que le listener ait créé l'alerte et
    // posé `escalatedAlertId` en base avant de répondre au client. Sans
    // cela, la réponse HTTP renverrait un statut PARTIALLY_FULFILLED sans
    // escalatedAlertId, qui n'arriverait qu'après coup — incohérent avec
    // le comportement Express d'origine, qui était synchrone à cet endroit.
    await this.emitter.emitAsync(
      'blood_request.handled',
      new BloodRequestHandledEvent(
        'PARTIALLY_FULFILL',
        requestId,
        user.healthStructureId!,
        request!.requestingHospital.id,
        request!.bloodType,
        request!.urgencyLevel,
        request!.serviceUnit,
        request!.quantityNeeded,
        qty,
        dto.radiusKm ?? 10,
        this._buildAgentUser(user),
      ),
    );

    // On relit l'état final (escalatedAlertId inclus) plutôt que de se fier
    // au retour de emitAsync, pour garantir que la réponse HTTP reflète
    // exactement ce qui est en base, quel que soit le nombre de listeners.
    const partial = await this.repository.findRequestById(requestId);

    this.events.emitToStructure(
      request!.requestingHospital.id,
      'blood_request:partial',
      { requestId, quantityProvided: qty },
    );

    this.logger.log(
      `BLOOD_REQUEST_PARTIAL — ${requestId} — qty: ${qty} — agent: ${user.id}`,
    );

    return partial;
  }

  private async _handleEscalate(
    requestId: string,
    request: Awaited<ReturnType<BloodRequestsRepository['findRequestById']>>,
    dto: HandleBloodRequestDto,
    user: AuthenticatedUser,
  ) {
    await this.repository.updateStatus(requestId, {
      status: BloodRequestStatus.ESCALATED_TO_ALERT,
      handledByUserId: user.id,
      cntsNotes: dto.cntsNotes ?? null,
    });

    // emitAsync pour la même raison que _handlePartialFulfill : on attend
    // que escalatedAlertId soit posé avant de répondre.
    await this.emitter.emitAsync(
      'blood_request.handled',
      new BloodRequestHandledEvent(
        'ESCALATE',
        requestId,
        user.healthStructureId!,
        request!.requestingHospital.id,
        request!.bloodType,
        request!.urgencyLevel,
        request!.serviceUnit,
        request!.quantityNeeded,
        0,
        dto.radiusKm ?? 10,
        this._buildAgentUser(user),
      ),
    );

    const escalated = await this.repository.findRequestById(requestId);

    this.events.emitToStructure(
      request!.requestingHospital.id,
      'blood_request:escalated',
      { requestId },
    );

    this.logger.log(
      `BLOOD_REQUEST_ESCALATED — ${requestId} — agent: ${user.id}`,
    );

    return escalated;
  }

  private async _handleReject(
    requestId: string,
    request: Awaited<ReturnType<BloodRequestsRepository['findRequestById']>>,
    dto: HandleBloodRequestDto,
    user: AuthenticatedUser,
  ) {
    const rejected = await this.repository.updateStatus(requestId, {
      status: BloodRequestStatus.REJECTED,
      handledByUserId: user.id,
      cntsNotes: dto.cntsNotes ?? null,
    });

    this.events.emitToStructure(
      request!.requestingHospital.id,
      'blood_request:rejected',
      { requestId },
    );

    this.logger.log(
      `BLOOD_REQUEST_REJECTED — ${requestId} — agent: ${user.id}`,
    );

    return rejected;
  }

  private _buildAgentUser(user: AuthenticatedUser) {
    return {
      id: user.id,
      healthStructureId: user.healthStructureId!,
      employerStructure: {
        id: user.employerStructure!.id,
        name: user.employerStructure!.name,
        structureType: StructureType.CNTS,
        isVerified: user.employerStructure!.isVerified,
        latitude: user.employerStructure!.latitude,
        longitude: user.employerStructure!.longitude,
        address: user.employerStructure!.address,
        affiliatedCntsId: user.employerStructure!.affiliatedCntsId,
      },
    };
  }
}

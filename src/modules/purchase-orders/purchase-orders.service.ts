import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { EventsService } from '@/events/events.service';
import { ListPurchaseOrdersDto } from './dto/list-purchase-orders.dto';
import { ConfirmExpiryDto } from './dto/confirm-expiry.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  PurchaseOrderStatus,
  StructureType,
  Role,
  BloodType,
} from '@/generated/prisma/enums';
import { generateDonationCode } from '@/common/utils/qr.utils';

const PURCHASE_ORDER_EXPIRY_HOURS = 24;

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly repository: PurchaseOrdersRepository,
    private readonly events: EventsService,
  ) {}

  async createForRequest(params: {
    bloodRequestId: string;
    cntsId: string;
    hospitalId: string;
    bloodType: BloodType;
    quantity: number;
  }) {
    const code = generateDonationCode().replace('VITA-', 'CMD-');
    const expiresAt = new Date(
      Date.now() + PURCHASE_ORDER_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const order = await this.repository.createOrder({
      ...params,
      code,
      expiresAt,
    });

    this.events.emitToStructure(params.hospitalId, 'purchase_order:created', {
      orderId: order.id,
      code: order.code,
      bloodType: order.bloodType,
      quantity: order.quantity,
      expiresAt: order.expiresAt,
    });

    this.logger.log(
      `PURCHASE_ORDER_CREATED — ${order.id} — cnts: ${params.cntsId} — hôpital: ${params.hospitalId}`,
    );

    return order;
  }

  async getByBloodRequest(bloodRequestId: string, user: AuthenticatedUser) {
    const order = await this.repository.findByBloodRequest(bloodRequestId);
    if (!order) throw new NotFoundException('Bon de commande introuvable');

    if (
      user.role !== Role.ADMIN &&
      order.hospital.id !== user.healthStructureId
    ) {
      throw new ForbiddenException('Accès refusé à ce bon de commande');
    }

    return order;
  }

  async scan(code: string, user: AuthenticatedUser) {
    const order = await this.repository.findByCode(code);
    if (!order) throw new NotFoundException('Bon de commande introuvable');

    if (order.cnts.id !== user.healthStructureId) {
      throw new ForbiddenException(
        "Ce bon de commande n'appartient pas à votre CNTS",
      );
    }

    if (order.status === PurchaseOrderStatus.USED) {
      throw new BadRequestException('Ce bon de commande a déjà été utilisé');
    }
    if (order.status === PurchaseOrderStatus.EXPIRED) {
      throw new BadRequestException('Ce bon de commande a expiré');
    }
    if (order.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Ce bon de commande a été annulé');
    }
    if (new Date() > new Date(order.expiresAt)) {
      throw new BadRequestException('Ce bon de commande a expiré');
    }

    const validated = await this.repository.markAsUsed(order.id, user.id);

    this.events.emitToStructure(order.hospital.id, 'purchase_order:validated', {
      orderId: order.id,
      code: order.code,
      scannedAt: validated.scannedAt,
      bloodType: order.bloodType,
      quantity: order.quantity,
    });

    this.logger.log(`PURCHASE_ORDER_SCANNED — ${order.id} — par ${user.id}`);

    return {
      message: 'Bon de commande validé. La remise du sang est confirmée.',
      order: validated,
    };
  }

  async confirmExpiry(
    id: string,
    dto: ConfirmExpiryDto,
    user: AuthenticatedUser,
  ) {
    const order = await this.repository.findOrderById(id);
    if (!order) throw new NotFoundException('Bon de commande introuvable');

    if (order.cnts.id !== user.healthStructureId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à confirmer ce bon",
      );
    }

    if (order.status !== PurchaseOrderStatus.EXPIRED) {
      throw new BadRequestException(
        'Seuls les bons expirés nécessitent une confirmation manuelle',
      );
    }

    const confirmed = await this.repository.confirmExpiry(
      id,
      dto.wasDelivered,
      dto.cntsNotes,
      user.id,
    );

    const event = dto.wasDelivered
      ? 'purchase_order:validated'
      : 'purchase_order:cancelled_stock_restored';

    this.events.emitToStructure(confirmed.hospital.id, event, {
      orderId: confirmed.id,
      code: confirmed.code,
      bloodType: confirmed.bloodType,
      quantity: confirmed.quantity,
      ...(dto.wasDelivered && { scannedAt: confirmed.scannedAt }),
    });

    this.logger.log(
      `PURCHASE_ORDER_EXPIRY_CONFIRMED — ${id} — remis: ${dto.wasDelivered}`,
    );

    return {
      message: dto.wasDelivered
        ? 'Bon confirmé comme remis. Le statut est passé à USED.'
        : 'Bon confirmé comme non remis. Le stock CNTS a été recrédité.',
      order: confirmed,
    };
  }

  async getList(user: AuthenticatedUser, dto: ListPurchaseOrdersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filters = { page, limit, status: dto.status };

    const isCnts = user.employerStructure?.structureType === StructureType.CNTS;

    const { data, total } = isCnts
      ? await this.repository.findByCnts(user.healthStructureId!, filters)
      : await this.repository.findByHospital(user.healthStructureId!, filters);

    return {
      orders: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

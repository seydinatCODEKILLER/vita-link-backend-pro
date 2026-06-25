import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { BloodStocksRepository } from './blood-stocks.repository';
import { EventsService } from '@/events/events.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ListStocksDto } from './dto/list-stocks.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { BloodStockLevel, StructureType } from '@/generated/prisma/enums';

@Injectable()
export class BloodStocksService {
  private readonly logger = new Logger(BloodStocksService.name);

  constructor(
    private readonly repository: BloodStocksRepository,
    private readonly events: EventsService,
  ) {}

  private calculateLevel(quantity: number): BloodStockLevel {
    if (quantity === 0) return BloodStockLevel.CRITICAL;
    if (quantity <= 5) return BloodStockLevel.LOW;
    if (quantity <= 15) return BloodStockLevel.ADEQUATE;
    return BloodStockLevel.SURPLUS;
  }

  async getMyStocks(user: AuthenticatedUser) {
    if (!user.healthStructureId) {
      throw new ForbiddenException("Vous n'êtes rattaché à aucune structure");
    }
    return this.repository.findByStructure(user.healthStructureId);
  }

  async updateMyStock(user: AuthenticatedUser, dto: UpdateStockDto) {
    if (!user.healthStructureId) {
      throw new ForbiddenException("Vous n'êtes rattaché à aucune structure");
    }
    if (user.employerStructure?.structureType !== StructureType.CNTS) {
      throw new ForbiddenException(
        'Seul un agent de la CNTS peut modifier le stock de sang',
      );
    }

    const level = this.calculateLevel(dto.quantity);

    const stock = await this.repository.upsertStock(
      user.healthStructureId,
      dto.bloodType,
      dto.quantity,
      level,
    );

    this.logger.log(
      `BLOOD_STOCK_UPDATED — ${user.healthStructureId} — ${dto.bloodType} — ${dto.quantity} — ${level}`,
    );

    this.events.emitToStructure(user.healthStructureId, 'stock:updated', {
      bloodType: dto.bloodType,
      quantity: dto.quantity,
      level,
    });

    if (level === BloodStockLevel.CRITICAL) {
      this.events.emitToAdmins('stock:critical', {
        structureId: user.healthStructureId,
        structureName: user.employerStructure?.name,
        bloodType: dto.bloodType,
        quantity: dto.quantity,
      });
    }

    return stock;
  }

  async getAllStocks(dto: ListStocksDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;

    const { data, total } = await this.repository.findAllWithStructure({
      level: dto.level,
      page,
      limit,
    });

    return {
      stocks: data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

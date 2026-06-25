import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { BloodStockLevel, BloodType } from '@/generated/prisma/enums';

const STOCK_SELECT = {
  id: true,
  bloodType: true,
  quantity: true,
  level: true,
  updatedAt: true,
} as const;

const STOCK_WITH_STRUCTURE_SELECT = {
  ...STOCK_SELECT,
  healthStructure: {
    select: { id: true, name: true, address: true },
  },
} as const;

@Injectable()
export class BloodStocksRepository extends BaseRepository<
  PrismaService['bloodStock']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.bloodStock);
  }

  findByStructure(structureId: string) {
    return this.model.findMany({
      where: { healthStructureId: structureId },
      select: STOCK_SELECT,
      orderBy: { bloodType: 'asc' },
    });
  }

  findAllWithStructure(filters: {
    level?: BloodStockLevel;
    page: number;
    limit: number;
  }) {
    const where = {
      ...(filters.level && { level: filters.level }),
    };

    return this.findManyWithCount(where, {
      page: filters.page,
      limit: filters.limit,
      orderBy: [{ level: 'asc' }, { bloodType: 'asc' }],
      select: STOCK_WITH_STRUCTURE_SELECT,
    });
  }

  upsertStock(
    structureId: string,
    bloodType: BloodType,
    quantity: number,
    level: BloodStockLevel,
  ) {
    return this.prisma.bloodStock.upsert({
      where: {
        healthStructureId_bloodType: {
          healthStructureId: structureId,
          bloodType,
        },
      },
      update: { quantity, level, lastSuppliedAt: new Date() },
      create: { healthStructureId: structureId, bloodType, quantity, level },
      select: STOCK_SELECT,
    });
  }

  findByCntsAndType(cntsId: string, bloodType: BloodType) {
    return this.model.findUnique({
      where: {
        healthStructureId_bloodType: {
          healthStructureId: cntsId,
          bloodType,
        },
      },
    });
  }

  async decrement(stockId: string, quantityToRemove: number) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.bloodStock.findUnique({
        where: { id: stockId },
        select: { quantity: true },
      });

      if (!current) throw new Error('Stock introuvable');
      if (current.quantity < quantityToRemove) {
        throw new Error(
          `Stock insuffisant. Actuel: ${current.quantity}, Demandé: ${quantityToRemove}`,
        );
      }

      const newQuantity = current.quantity - quantityToRemove;
      const newLevel = this._calculateLevel(newQuantity);

      return tx.bloodStock.update({
        where: { id: stockId },
        data: {
          quantity: newQuantity,
          level: newLevel,
          lastSuppliedAt: new Date(),
        },
        select: STOCK_SELECT,
      });
    });
  }

  private _calculateLevel(quantity: number): BloodStockLevel {
    if (quantity === 0) return BloodStockLevel.CRITICAL;
    if (quantity <= 5) return BloodStockLevel.LOW;
    if (quantity <= 15) return BloodStockLevel.ADEQUATE;
    return BloodStockLevel.SURPLUS;
  }
}

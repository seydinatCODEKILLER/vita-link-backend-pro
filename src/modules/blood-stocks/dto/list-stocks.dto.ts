import { IsInt, IsOptional, IsIn, Min, Max } from 'class-validator'; // ✅ IsIn ajouté, IsEnum supprimé
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodStockLevel } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils'; // ✅ Notre helper

export class ListStocksDto {
  @ApiPropertyOptional({ enum: BloodStockLevel })
  @IsIn(getEnumValues(BloodStockLevel), { message: 'Niveau de stock invalide' }) // ✅ Corrigé
  @IsOptional()
  level?: BloodStockLevel;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}

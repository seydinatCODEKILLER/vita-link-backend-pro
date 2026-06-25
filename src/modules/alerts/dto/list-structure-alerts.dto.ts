import { IsIn, IsInt, IsOptional, Min, Max } from 'class-validator'; // ✅ IsIn ajouté, IsEnum supprimé
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils'; // ✅ Notre helper

export class ListStructureAlertsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: AlertStatus })
  @IsIn(getEnumValues(AlertStatus), { message: 'Statut invalide' }) // ✅ Corrigé
  @IsOptional()
  status?: AlertStatus;
}

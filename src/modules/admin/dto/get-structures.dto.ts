import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HealthStructureStatus, StructureType } from '@/generated/prisma/enums';

const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Sédhiou',
  'Saint-Louis',
  'Tambacounda',
  'Thiès',
  'Ziguinchor',
] as const;

export type SenegalRegion = (typeof SENEGAL_REGIONS)[number];

export class GetStructuresDto {
  @ApiPropertyOptional({ enum: HealthStructureStatus })
  @IsEnum(HealthStructureStatus)
  @IsOptional()
  status?: HealthStructureStatus;

  @ApiPropertyOptional({
    enum: StructureType,
    description: 'Filtrer par type de structure',
  })
  @IsEnum(StructureType)
  @IsOptional()
  structureType?: StructureType;

  @ApiPropertyOptional({
    enum: SENEGAL_REGIONS,
    description: 'Filtrer par région administrative du Sénégal',
  })
  @IsEnum(SENEGAL_REGIONS, { message: 'Région invalide' })
  @IsOptional()
  region?: SenegalRegion;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

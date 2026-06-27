import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, UrgencyLevel, ServiceUnit } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class CreateBloodRequestDto {
  @ApiProperty({ enum: BloodType, example: 'O_NEG' })
  @IsIn(getEnumValues(BloodType), { message: 'Groupe sanguin invalide' })
  bloodType!: BloodType;

  @ApiProperty({ example: 3, minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  quantityNeeded!: number;

  @ApiProperty({ enum: UrgencyLevel, example: 'VITAL' })
  @IsIn(getEnumValues(UrgencyLevel), { message: "Niveau d'urgence invalide" })
  urgencyLevel!: UrgencyLevel;

  @ApiPropertyOptional({ enum: ServiceUnit, default: 'GENERAL' })
  @IsIn(getEnumValues(ServiceUnit), { message: 'Service invalide' })
  @IsOptional()
  serviceUnit?: ServiceUnit = ServiceUnit.GENERAL;

  @ApiPropertyOptional({ example: 'Hémorragie post-opératoire.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  clinicalContext?: string;
}

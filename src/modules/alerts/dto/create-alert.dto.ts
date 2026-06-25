import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BloodType,
  UrgencyLevel,
  ServiceUnit,
  AlertOrigin,
} from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class CreateAlertDto {
  @ApiProperty({ enum: BloodType, example: 'O_NEG' })
  @IsIn(getEnumValues(BloodType), { message: 'Groupe sanguin invalide' })
  bloodType!: BloodType;

  @ApiProperty({ example: 2, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1, { message: 'Au moins 1 poche requise' })
  @Max(20, { message: 'Quantité maximale : 20 poches' })
  quantityNeeded!: number;

  @ApiProperty({ enum: UrgencyLevel, example: 'VITAL' })
  @IsIn(getEnumValues(UrgencyLevel), { message: "Niveau d'urgence invalide" })
  urgencyLevel!: UrgencyLevel;

  @ApiPropertyOptional({ enum: ServiceUnit, default: 'GENERAL' })
  @IsIn(getEnumValues(ServiceUnit), { message: 'Service invalide' })
  @IsOptional()
  serviceUnit?: ServiceUnit = ServiceUnit.GENERAL;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  radiusKm?: number = 10;

  @ApiPropertyOptional({ example: 'Avenue Nelson Mandela, Dakar' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 14.6937 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: -17.4441 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ enum: AlertOrigin })
  @IsIn(getEnumValues(AlertOrigin), { message: "Origine de l'alerte invalide" })
  @IsOptional()
  origin?: AlertOrigin;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  bloodRequestId?: string;
}

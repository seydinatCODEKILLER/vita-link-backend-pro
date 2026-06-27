import {
  IsString,
  IsUUID,
  IsInt,
  IsBoolean,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { getEnumValues } from '@/common/utils/validators.utils';
import { RewardType } from '@/generated/prisma/enums';

export class CreateRewardDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsUUID()
  partnerId!: string;

  @ApiProperty({ example: 'Ticket de bus gratuit' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'Valable 1 trajet sur la ligne Dakar-Diamniadio' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ example: 150 })
  @IsInt()
  @Min(1)
  pointsCost!: number;

  @ApiProperty({ enum: RewardType })
  @IsIn(getEnumValues(RewardType), { message: 'Type de récompense invalide' })
  rewardType!: RewardType;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number = 0;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isUnlimited?: boolean = false;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}

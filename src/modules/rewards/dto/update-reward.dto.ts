import {
  IsString,
  IsUUID,
  IsInt,
  IsBoolean,
  IsIn,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RewardType } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class UpdateRewardDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  partnerId?: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @IsOptional()
  pointsCost?: number;

  @ApiPropertyOptional({ enum: RewardType })
  @IsIn(getEnumValues(RewardType), { message: 'Type de récompense invalide' })
  @IsOptional()
  rewardType?: RewardType;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isUnlimited?: boolean;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresAt?: string | null;
}

import { IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CouponStatus } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class ListCouponsDto {
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

  @ApiPropertyOptional({ enum: CouponStatus })
  @IsIn(getEnumValues(CouponStatus), { message: 'Statut invalide' })
  @IsOptional()
  status?: CouponStatus;
}

import { IsInt, IsOptional, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodRequestStatus } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class ListBloodRequestsDto {
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

  @ApiPropertyOptional({ enum: BloodRequestStatus })
  @IsIn(getEnumValues(BloodRequestStatus), { message: 'Statut invalide' })
  @IsOptional()
  status?: BloodRequestStatus;
}

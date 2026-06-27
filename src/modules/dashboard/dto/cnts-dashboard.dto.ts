import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CntsDashboardDto {
  @ApiPropertyOptional({
    default: 5,
    description: 'Nombre de demandes récentes à retourner',
  })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  @Type(() => Number)
  recentRequestsLimit?: number = 5;
}

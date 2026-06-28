import { IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetMonthlyStatsDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  year?: number;
}

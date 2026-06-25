import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmResponseDto {
  @ApiPropertyOptional({ example: 12 })
  @IsNumber()
  @Min(1)
  @Max(120)
  @IsOptional()
  etaMinutes?: number;
}

import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListNearbyAlertsDto {
  @ApiPropertyOptional({ example: 14.6937 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: -17.4441 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  radius?: number = 15;
}

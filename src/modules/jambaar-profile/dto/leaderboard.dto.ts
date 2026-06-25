import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LeaderboardDto {
  @ApiPropertyOptional({ example: 'Dakar' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Plateau' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  district?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

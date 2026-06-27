import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  Validate,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidJsonConstraint } from './is-valid-json.constraint';

export class UpdateBadgeDto {
  @ApiPropertyOptional({ example: 'Guerrier' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ example: '{"minDonations": 5}' })
  @IsString()
  @Validate(IsValidJsonConstraint)
  @IsOptional()
  criteria?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isSeasonal?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  season?: string;
}

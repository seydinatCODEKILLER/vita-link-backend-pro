import {
  IsString,
  IsUrl,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePartnerDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;
}

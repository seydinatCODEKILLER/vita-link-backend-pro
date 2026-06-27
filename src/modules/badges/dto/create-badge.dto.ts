import {
  IsString,
  IsBoolean,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  Validate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsValidJsonConstraint } from './is-valid-json.constraint';

export class CreateBadgeDto {
  @ApiProperty({ example: 'Guerrier' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'A effectué 5 dons de sang' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/...' })
  @IsUrl()
  @IsOptional()
  iconUrl?: string;

  @ApiProperty({ example: '{"minDonations": 5}' })
  @IsString()
  @Validate(IsValidJsonConstraint)
  criteria!: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isSeasonal?: boolean = false;

  @ApiPropertyOptional({ example: 'Ramadan 2024' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  season?: string;
}

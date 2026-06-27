import {
  IsString,
  IsUrl,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePartnerDto {
  @ApiProperty({ example: 'Orange Sonatel' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Leader des télécoms au Sénégal' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://orange.sn' })
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;
}

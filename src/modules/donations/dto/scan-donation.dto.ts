import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScanDonationDto {
  @ApiProperty({ example: 'VITA-X9K2-M4P7' })
  @IsString()
  @MinLength(1)
  @Matches(/^VITA-[A-Z0-9]{4}-[A-Z0-9]{4}$/, {
    message: 'Format de QR Code invalide (attendu : VITA-XXXX-XXXX)',
  })
  qrCode!: string;

  @ApiPropertyOptional({ example: 'Don sans incident' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  testResultsJson?: string;
}

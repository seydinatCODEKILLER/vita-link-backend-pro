import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmExpiryDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  wasDelivered!: boolean;

  @ApiPropertyOptional({ example: 'Livraison confirmée.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  cntsNotes?: string;
}

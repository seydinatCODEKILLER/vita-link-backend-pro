import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type BloodRequestAction =
  | 'FULFILL'
  | 'PARTIALLY_FULFILL'
  | 'ESCALATE'
  | 'REJECT';

export class HandleBloodRequestDto {
  @ApiProperty({
    enum: ['FULFILL', 'PARTIALLY_FULFILL', 'ESCALATE', 'REJECT'],
    example: 'PARTIALLY_FULFILL',
  })
  @IsEnum(['FULFILL', 'PARTIALLY_FULFILL', 'ESCALATE', 'REJECT'])
  action!: BloodRequestAction;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @ValidateIf((o: HandleBloodRequestDto) => o.action === 'PARTIALLY_FULFILL')
  quantityProvided?: number;

  @ApiPropertyOptional({ example: 'Stock partiel disponible.' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  cntsNotes?: string;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  radiusKm?: number = 10;
}

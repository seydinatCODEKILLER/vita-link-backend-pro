import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SuspendStructureDto {
  @ApiPropertyOptional({ example: 'Agrément médical périmé' })
  @IsString()
  @MinLength(5, { message: 'Raison requise' })
  @IsOptional()
  reason?: string;
}

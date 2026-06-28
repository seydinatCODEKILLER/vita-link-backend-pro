import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiPropertyOptional({
    example: 'Trop de No-shows consécutifs signalés par les hôpitaux',
  })
  @IsString()
  @MinLength(5, { message: 'Raison requise (min 5 caractères)' })
  @IsOptional()
  reason?: string;
}

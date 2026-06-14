import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStructureDto {
  @ApiPropertyOptional({ example: 'Nouveau Nom Hôpital' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Rue Y, Dakar' })
  @IsString()
  @MinLength(5)
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '+221338000000' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Numéro de téléphone invalide' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@hopital.sn' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 14.6937 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: -17.4441 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  @IsOptional()
  @ValidateIf((o: UpdateStructureDto) => o.affiliatedCntsId !== null)
  affiliatedCntsId?: string | null;
}

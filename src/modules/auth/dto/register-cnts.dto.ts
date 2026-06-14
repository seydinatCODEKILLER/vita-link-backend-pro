import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SENEGAL_REGIONS,
  type SenegalRegion,
} from '@/common/constants/regions.constant';
import { IsIn } from 'class-validator';

export class RegisterCntsDto {
  @ApiProperty({ example: 'Dr. Aminata' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Diop' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ example: 'admin.cnts@transfusion.sn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+221338000000' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;

  @ApiProperty({ example: 'CntsSecure2024!' })
  @IsString()
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères',
  })
  @Matches(/[A-Z]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule',
  })
  @Matches(/[0-9]/, {
    message: 'Le mot de passe doit contenir au moins un chiffre',
  })
  password!: string;

  @ApiProperty({ example: 'Centre National de Transfusion Sanguine de Dakar' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  structureName!: string;

  @ApiProperty({ example: 'CNTS-DKR-001' })
  @IsString()
  @MinLength(3)
  registrationNumber!: string;

  @ApiProperty({ example: 'Avenue Blaise Diagne, Dakar' })
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiProperty({ enum: SENEGAL_REGIONS, example: 'Dakar' })
  @IsIn(SENEGAL_REGIONS, { message: 'Veuillez sélectionner une région valide' })
  region!: SenegalRegion;

  // Les optionnelles restent avec ? uniquement
  @ApiPropertyOptional({ example: '+221338000001' })
  @IsString()
  @IsOptional()
  structurePhone?: string;

  @ApiPropertyOptional({ example: 'contact@cnts-dakar.sn' })
  @IsEmail()
  @IsOptional()
  structureEmail?: string;

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
}

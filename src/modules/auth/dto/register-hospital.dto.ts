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
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SENEGAL_REGIONS,
  type SenegalRegion,
} from '@/common/constants/regions.constant';
import { StructureType } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class RegisterHospitalDto {
  @ApiProperty({ example: 'Dr. Moussa' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Sow' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ example: 'dr.sow@hpd.sn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+221771234567' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Numéro de téléphone invalide' })
  phone!: string;

  @ApiProperty({ example: 'Motdepasse123!' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule',
  })
  @Matches(/[0-9]/, {
    message: 'Le mot de passe doit contenir au moins un chiffre',
  })
  password!: string;

  @ApiProperty({ example: 'Hôpital Principal de Dakar' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  structureName!: string;

  @ApiProperty({ example: 'SN-MED-2024-001' })
  @IsString()
  @MinLength(3)
  registrationNumber!: string;

  @ApiProperty({ example: 'Avenue Nelson Mandela, Dakar' })
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiProperty({ enum: SENEGAL_REGIONS, example: 'Dakar' })
  @IsIn(SENEGAL_REGIONS, { message: 'Veuillez sélectionner une région valide' })
  region!: SenegalRegion;

  @ApiProperty({ enum: ['HOSPITAL', 'HEALTH_CENTER'], example: 'HOSPITAL' })
  @IsIn(getEnumValues(StructureType), { message: 'Type de structure invalide' }) // ✅ Corrigé
  structureType!: StructureType;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  affiliatedCntsId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  structurePhone?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  structureEmail?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @IsOptional()
  longitude?: number;
}

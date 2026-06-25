import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, Gender } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Aliou' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Diallo' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsIn(getEnumValues(Gender), { message: 'Genre invalide' })
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ enum: BloodType })
  @IsIn(getEnumValues(BloodType), { message: 'Groupe sanguin invalide' })
  @IsOptional()
  bloodType?: BloodType;

  @ApiPropertyOptional({ example: '1995-06-15' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}

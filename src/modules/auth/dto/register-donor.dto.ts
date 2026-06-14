import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, Gender } from '@/generated/prisma/enums';

export class RegisterDonorDto {
  @ApiProperty({ example: 'Aliou' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Diallo' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ example: '+221771234567' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Numéro de téléphone invalide (ex: +221771234567)',
  })
  phone!: string;

  @ApiPropertyOptional({ example: 'aliou@gmail.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ enum: BloodType })
  @IsEnum(BloodType)
  @IsOptional()
  bloodType?: BloodType;

  @ApiProperty({ enum: Gender })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiPropertyOptional({ example: '1995-06-15' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;
}

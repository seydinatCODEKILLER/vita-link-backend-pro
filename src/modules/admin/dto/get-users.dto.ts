import { IsInt, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role, BloodType } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils';

export class GetUsersDto {
  @ApiPropertyOptional({ enum: Role })
  @IsIn(getEnumValues(Role), { message: 'Rôle invalide' })
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ enum: BloodType })
  @IsIn(getEnumValues(BloodType), { message: 'Groupe sanguin invalide' })
  @IsOptional()
  bloodType?: BloodType;

  @ApiPropertyOptional({ example: 'Dakar' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'true' })
  @Transform(({ value }): boolean | undefined => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}

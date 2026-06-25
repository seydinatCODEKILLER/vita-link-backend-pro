import { IsInt, IsIn, Min, Max } from 'class-validator'; // ✅ IsIn ajouté, IsEnum supprimé
import { ApiProperty } from '@nestjs/swagger';
import { BloodType } from '@/generated/prisma/enums';
import { getEnumValues } from '@/common/utils/validators.utils'; // ✅ Notre helper

export class UpdateStockDto {
  @ApiProperty({ enum: BloodType, example: 'O_NEG' })
  @IsIn(getEnumValues(BloodType), { message: 'Groupe sanguin invalide' }) // ✅ Corrigé
  bloodType!: BloodType;

  @ApiProperty({ example: 4, minimum: 0, maximum: 500 })
  @IsInt()
  @Min(0, { message: 'La quantité ne peut pas être négative' })
  @Max(500, { message: 'Quantité irréaliste' })
  quantity!: number;
}

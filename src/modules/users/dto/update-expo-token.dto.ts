import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateExpoTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @MinLength(1)
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'Format de token Expo invalide',
  })
  expoPushToken!: string;
}

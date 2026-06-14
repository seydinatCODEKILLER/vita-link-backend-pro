import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'dr.sow@hpd.sn' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Motdepasse123!' })
  @IsString()
  @MinLength(1)
  password!: string;
}

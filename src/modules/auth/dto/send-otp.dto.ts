import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'aliou@gmail.com' })
  @IsEmail()
  email!: string;
}

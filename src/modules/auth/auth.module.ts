import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { OtpRepository } from './otp.repository';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { AuthEmailService } from './email.service';
import { HealthStructuresModule } from '@/modules/health-structures/health-structures.module';
import { JwtStrategy } from '@/common/strategies/jwt.strategy';
import type { SignOptions } from 'jsonwebtoken';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>(
            'JWT_DURATION',
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
    HealthStructuresModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    OtpRepository,
    OtpService,
    TokenService,
    AuthEmailService,
    JwtStrategy,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

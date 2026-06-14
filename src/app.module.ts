import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { databaseConfig } from './config/database.config';
import { brevoConfig } from './config/brevo.config';
import { jwtConfig } from './config/jwt.config';
import { appConfig } from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { HealthStructuresModule } from './modules/health-structures/health-structures.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
      load: [appConfig, jwtConfig, brevoConfig, databaseConfig],
    }),
    PrismaModule,
    AuthModule,
    HealthStructuresModule,
  ],
})
export class AppModule {}

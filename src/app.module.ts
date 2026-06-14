import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { envValidationSchema } from './config/env.validation';
import { databaseConfig } from './config/database.config';
import { brevoConfig } from './config/brevo.config';
import { jwtConfig } from './config/jwt.config';
import { appConfig } from './config/app.config';

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
  ],
})
export class AppModule {}

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
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './events/events.module';
import { BloodStocksModule } from './modules/blood-stocks/blood-stocks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AlertResponsesModule } from './modules/alert-responses/alert-responses.module';
import { JambaarsModule } from './modules/jambaar-profile/jambaar-profile.module';
import { DonationsModule } from './modules/donations/donations.module';

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
    EventsModule,
    NotificationsModule,
    BloodStocksModule,
    AuthModule,
    HealthStructuresModule,
    UsersModule,
    AlertsModule,
    AlertResponsesModule,
    JambaarsModule,
    DonationsModule,
  ],
})
export class AppModule {}

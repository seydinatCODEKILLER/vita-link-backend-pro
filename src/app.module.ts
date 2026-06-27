import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { BloodRequestsModule } from './modules/blood-requests/blood-requests.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { BadgesModule } from './modules/badges/badges.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { PartnersModule } from './modules/partners/partners.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { NotificationsHistoryModule } from './modules/notifications-history/notifications-history.module';

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
    EventEmitterModule.forRoot(),
    PrismaModule,
    EventsModule,
    NotificationsModule,
    CloudinaryModule,
    BloodStocksModule,
    AuthModule,
    HealthStructuresModule,
    UsersModule,
    BloodRequestsModule,
    AlertsModule,
    PurchaseOrdersModule,
    AlertResponsesModule,
    JambaarsModule,
    DonationsModule,
    BadgesModule,
    PartnersModule,
    RewardsModule,
    CouponsModule,
    NotificationsHistoryModule,
  ],
})
export class AppModule {}

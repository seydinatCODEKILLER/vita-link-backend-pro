import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsRepository } from './alerts.repository';
import { BloodRequestHandledListener } from './listeners/blood-request-handled.listener';
import { BloodRequestsModule } from '@/modules/blood-requests/blood-requests.module';

@Module({
  imports: [BloodRequestsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsRepository, BloodRequestHandledListener],
  exports: [AlertsService, AlertsRepository],
})
export class AlertsModule {}

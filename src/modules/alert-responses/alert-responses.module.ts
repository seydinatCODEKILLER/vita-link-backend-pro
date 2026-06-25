import { Module } from '@nestjs/common';
import { AlertResponsesController } from './alert-responses.controller';
import { AlertResponsesService } from './alert-responses.service';
import { AlertResponsesRepository } from './alert-responses.repository';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [AlertResponsesController],
  providers: [AlertResponsesService, AlertResponsesRepository],
  exports: [AlertResponsesService, AlertResponsesRepository],
})
export class AlertResponsesModule {}

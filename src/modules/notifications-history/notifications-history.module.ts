import { Module } from '@nestjs/common';
import { NotificationsHistoryController } from './notifications-history.controller';
import { NotificationsHistoryService } from './notifications-history.service';
import { NotificationsHistoryRepository } from './notifications-history.repository';

@Module({
  controllers: [NotificationsHistoryController],
  providers: [NotificationsHistoryService, NotificationsHistoryRepository],
  exports: [NotificationsHistoryService],
})
export class NotificationsHistoryModule {}

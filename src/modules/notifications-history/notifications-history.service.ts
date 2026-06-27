import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { NotificationsHistoryRepository } from './notifications-history.repository';
import { ListMyNotificationsDto } from './dto/list-my-notifications.dto';

@Injectable()
export class NotificationsHistoryService {
  private readonly logger = new Logger(NotificationsHistoryService.name);

  constructor(private readonly repository: NotificationsHistoryRepository) {}

  async getMyNotifications(userId: string, dto: ListMyNotificationsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const { data, total } = await this.repository.findMyNotifications(userId, {
      page,
      limit,
      isRead: dto.isRead,
    });

    return {
      notifications: data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.repository.findNotificationById(id);

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        "Vous n'êtes pas autorisé à modifier cette notification",
      );
    }

    if (notification.isRead) {
      return notification;
    }

    const updated = await this.repository.markAsRead(id);

    this.logger.log(`NOTIFICATION_READ — ${id} — userId: ${userId}`);

    return updated;
  }

  async deleteAllMyNotifications(userId: string) {
    const result = await this.repository.deleteAllByUserId(userId);

    this.logger.log(
      `NOTIFICATIONS_CLEARED — userId: ${userId} — deletedCount: ${result.count}`,
    );

    return { deletedCount: result.count };
  }
}

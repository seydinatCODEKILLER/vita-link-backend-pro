import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  channel: true,
  payload: true,
  status: true,
  isRead: true,
  sentAt: true,
  createdAt: true,
  alert: {
    select: { id: true, bloodType: true, urgencyLevel: true },
  },
} as const;

const NOTIFICATION_DETAIL_SELECT = {
  ...NOTIFICATION_SELECT,
  userId: true,
} as const;

export type NotificationSummary = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_SELECT;
}>;

export type NotificationDetail = Prisma.NotificationGetPayload<{
  select: typeof NOTIFICATION_DETAIL_SELECT;
}>;

@Injectable()
export class NotificationsHistoryRepository extends BaseRepository<
  PrismaService['notification']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.notification);
  }

  findMyNotifications(
    userId: string,
    filters: { page: number; limit: number; isRead?: boolean },
  ) {
    return this.findManyWithCount<NotificationSummary>(
      {
        userId,
        ...(filters.isRead !== undefined && { isRead: filters.isRead }),
      },
      {
        page: filters.page,
        limit: filters.limit,
        orderBy: { createdAt: 'desc' },
        select: NOTIFICATION_SELECT,
      },
    );
  }

  findNotificationById(id: string): Promise<NotificationDetail | null> {
    return this.model.findUnique({
      where: { id },
      select: NOTIFICATION_DETAIL_SELECT,
    });
  }

  markAsRead(id: string): Promise<NotificationSummary> {
    return this.model.update({
      where: { id },
      data: { isRead: true },
      select: NOTIFICATION_SELECT,
    });
  }

  deleteAllByUserId(userId: string): Promise<{ count: number }> {
    return this.model.deleteMany({ where: { userId } });
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsHistoryRepository } from './notifications-history.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  notification: {
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
});

const NOTIFICATION_SUMMARY = {
  id: 'notif-1',
  type: 'ALERT_NEW',
  channel: 'PUSH_EXPO',
  payload: '{"alertId":"uuid-alert"}',
  status: 'DELIVERED',
  isRead: false,
  sentAt: new Date('2026-06-01'),
  createdAt: new Date('2026-06-01'),
  alert: { id: 'uuid-alert', bloodType: 'O_NEG', urgencyLevel: 'VITAL' },
};

const NOTIFICATION_DETAIL = {
  ...NOTIFICATION_SUMMARY,
  userId: 'user-1',
};

describe('NotificationsHistoryRepository', () => {
  let repository: NotificationsHistoryRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsHistoryRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(NotificationsHistoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findNotificationById', () => {
    it('retourne la notification avec le select detail complet', async () => {
      prisma.notification.findUnique.mockResolvedValue(NOTIFICATION_DETAIL);

      const result = await repository.findNotificationById('notif-1');

      expect(prisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        select: expect.objectContaining({ id: true, userId: true }),
      });
      expect(result).toEqual(NOTIFICATION_DETAIL);
    });

    it('retourne null si la notification est introuvable', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      const result = await repository.findNotificationById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('met isRead à true et retourne le select summary', async () => {
      const updated = { ...NOTIFICATION_SUMMARY, isRead: true };
      prisma.notification.update.mockResolvedValue(updated);

      const result = await repository.markAsRead('notif-1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
        select: expect.objectContaining({ id: true, isRead: true }),
      });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteAllByUserId', () => {
    it("supprime toutes les notifications de l'utilisateur", async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repository.deleteAllByUserId('user-1');

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual({ count: 5 });
    });

    it('retourne count à 0 si aucune notification', async () => {
      prisma.notification.deleteMany.mockResolvedValue({ count: 0 });

      const result = await repository.deleteAllByUserId('user-sans-notifs');

      expect(result).toEqual({ count: 0 });
    });
  });
});

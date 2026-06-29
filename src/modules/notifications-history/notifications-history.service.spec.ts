import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsHistoryService } from './notifications-history.service';
import { NotificationsHistoryRepository } from './notifications-history.repository';

const createMockRepository = () => ({
  findMyNotifications: jest.fn(),
  findNotificationById: jest.fn(),
  markAsRead: jest.fn(),
  deleteAllByUserId: jest.fn(),
});

const NOTIFICATION_DETAIL = {
  id: 'notif-1',
  type: 'ALERT_NEW',
  channel: 'PUSH_EXPO',
  payload: '{"alertId":"uuid-alert"}',
  status: 'DELIVERED',
  isRead: false,
  sentAt: new Date('2026-06-01'),
  createdAt: new Date('2026-06-01'),
  alert: { id: 'uuid-alert', bloodType: 'O_NEG', urgencyLevel: 'VITAL' },
  userId: 'user-1',
};

describe('NotificationsHistoryService', () => {
  let service: NotificationsHistoryService;
  let repository: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    repository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsHistoryService,
        { provide: NotificationsHistoryRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(NotificationsHistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyNotifications', () => {
    it('retourne les notifications paginées avec les valeurs par défaut', async () => {
      repository.findMyNotifications.mockResolvedValue({
        data: [NOTIFICATION_DETAIL],
        total: 1,
      });

      const result = await service.getMyNotifications('user-1', {});

      expect(repository.findMyNotifications).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
        isRead: undefined,
      });
      expect(result).toEqual({
        notifications: [NOTIFICATION_DETAIL],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('utilise les valeurs page et limit fournies dans le dto', async () => {
      repository.findMyNotifications.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await service.getMyNotifications('user-1', {
        page: 2,
        limit: 10,
        isRead: false,
      });

      expect(repository.findMyNotifications).toHaveBeenCalledWith('user-1', {
        page: 2,
        limit: 10,
        isRead: false,
      });
      expect(result.pagination).toEqual({
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      });
    });

    it('calcule correctement totalPages', async () => {
      repository.findMyNotifications.mockResolvedValue({
        data: [],
        total: 45,
      });

      const result = await service.getMyNotifications('user-1', {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('marque la notification comme lue', async () => {
      repository.findNotificationById.mockResolvedValue(NOTIFICATION_DETAIL);
      const updated = { ...NOTIFICATION_DETAIL, isRead: true };
      repository.markAsRead.mockResolvedValue(updated);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(repository.markAsRead).toHaveBeenCalledWith('notif-1');
      expect(result).toEqual(updated);
    });

    it('retourne la notification sans écriture si déjà lue', async () => {
      const alreadyRead = { ...NOTIFICATION_DETAIL, isRead: true };
      repository.findNotificationById.mockResolvedValue(alreadyRead);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(repository.markAsRead).not.toHaveBeenCalled();
      expect(result).toEqual(alreadyRead);
    });

    it('lève NotFoundException si la notification est introuvable', async () => {
      repository.findNotificationById.mockResolvedValue(null);

      await expect(service.markAsRead('inexistant', 'user-1')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.markAsRead).not.toHaveBeenCalled();
    });

    it('lève ForbiddenException si la notification appartient à un autre utilisateur', async () => {
      repository.findNotificationById.mockResolvedValue(NOTIFICATION_DETAIL);

      await expect(service.markAsRead('notif-1', 'autre-user')).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.markAsRead).not.toHaveBeenCalled();
    });
  });

  describe('deleteAllMyNotifications', () => {
    it('supprime toutes les notifications et retourne le count', async () => {
      repository.deleteAllByUserId.mockResolvedValue({ count: 7 });

      const result = await service.deleteAllMyNotifications('user-1');

      expect(repository.deleteAllByUserId).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ deletedCount: 7 });
    });

    it('retourne deletedCount à 0 si aucune notification', async () => {
      repository.deleteAllByUserId.mockResolvedValue({ count: 0 });

      const result = await service.deleteAllMyNotifications('user-1');

      expect(result).toEqual({ deletedCount: 0 });
    });
  });
});

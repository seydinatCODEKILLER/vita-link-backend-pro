import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from './push.service';

// `Expo` est instancié directement dans PushService (`new Expo()`), pas
// injecté — impossible de le remplacer via le système d'injection NestJS.
// On mocke donc tout le module `expo-server-sdk` : `Expo.isExpoPushToken`
// (méthode statique) et les méthodes d'instance utilisées
// (chunkPushNotifications, sendPushNotificationsAsync).
const mockIsExpoPushToken = jest.fn();
const mockChunkPushNotifications = jest.fn();
const mockSendPushNotificationsAsync = jest.fn();

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({
    chunkPushNotifications: mockChunkPushNotifications,
    sendPushNotificationsAsync: mockSendPushNotificationsAsync,
  })),
}));

// `Expo.isExpoPushToken` est une méthode statique : on doit la rattacher
// après le mock du constructeur ci-dessus, sur le même objet que celui
// importé par push.service.ts.
import { Expo } from 'expo-server-sdk';
(Expo as unknown as { isExpoPushToken: jest.Mock }).isExpoPushToken =
  mockIsExpoPushToken;

describe('PushService', () => {
  let service: PushService;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PushService],
    }).compile();

    service = module.get(PushService);

    // On espionne le Logger NestJS plutôt que console.* directement, pour
    // vérifier que les bons messages sont bien loggés sans polluer la
    // sortie des tests.
    loggerWarnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    loggerLogSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerWarnSpy.mockRestore();
    loggerErrorSpy.mockRestore();
    loggerLogSpy.mockRestore();
  });

  describe('sendToOne', () => {
    it("ignore l'envoi et logue un warning si le token est invalide", async () => {
      mockIsExpoPushToken.mockReturnValue(false);

      await service.sendToOne({
        token: 'invalid-token',
        title: 'Titre',
        body: 'Corps',
      });

      expect(mockChunkPushNotifications).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Push token invalide'),
      );
    });

    it('envoie le message avec les bons champs pour un token valide', async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      const message = {
        to: 'ExponentPushToken[valid]',
        sound: 'default',
        title: 'Titre',
        body: 'Corps',
        data: { type: 'TEST' },
      };
      mockChunkPushNotifications.mockReturnValue([[message]]);
      mockSendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

      await service.sendToOne({
        token: 'ExponentPushToken[valid]',
        title: 'Titre',
        body: 'Corps',
        data: { type: 'TEST' },
      });

      expect(mockChunkPushNotifications).toHaveBeenCalledWith([
        {
          to: 'ExponentPushToken[valid]',
          sound: 'default',
          title: 'Titre',
          body: 'Corps',
          data: { type: 'TEST' },
        },
      ]);
      expect(mockSendPushNotificationsAsync).toHaveBeenCalledWith([message]);
    });

    it('utilise un objet data vide par défaut si non fourni', async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      mockChunkPushNotifications.mockReturnValue([[]]);
      mockSendPushNotificationsAsync.mockResolvedValue([]);

      await service.sendToOne({
        token: 'ExponentPushToken[valid]',
        title: 'Titre',
        body: 'Corps',
      });

      expect(mockChunkPushNotifications).toHaveBeenCalledWith([
        expect.objectContaining({ data: {} }),
      ]);
    });

    it("logue une erreur si un receipt retourne le statut 'error'", async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      mockChunkPushNotifications.mockReturnValue([[{}]]);
      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'error', message: 'DeviceNotRegistered' },
      ]);

      await service.sendToOne({
        token: 'ExponentPushToken[valid]',
        title: 'Titre',
        body: 'Corps',
      });

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DeviceNotRegistered'),
      );
    });

    it('catche silencieusement une exception levée par sendPushNotificationsAsync', async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      mockChunkPushNotifications.mockReturnValue([[{}]]);
      mockSendPushNotificationsAsync.mockRejectedValue(
        new Error('Network error'),
      );

      await expect(
        service.sendToOne({
          token: 'ExponentPushToken[valid]',
          title: 'Titre',
          body: 'Corps',
        }),
      ).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Échec envoi push unitaire',
        expect.any(Error),
      );
    });
  });

  describe('sendMulticast', () => {
    it('retourne null sans appeler Expo si la liste de tokens est vide', async () => {
      const result = await service.sendMulticast({
        tokens: [],
        title: 'Titre',
        body: 'Corps',
      });

      expect(result).toBeNull();
      expect(mockIsExpoPushToken).not.toHaveBeenCalled();
      expect(mockChunkPushNotifications).not.toHaveBeenCalled();
    });

    it('retourne null si tous les tokens sont invalides', async () => {
      mockIsExpoPushToken.mockReturnValue(false);

      const result = await service.sendMulticast({
        tokens: ['bad-1', 'bad-2'],
        title: 'Titre',
        body: 'Corps',
      });

      expect(result).toBeNull();
      expect(mockChunkPushNotifications).not.toHaveBeenCalled();
      expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('filtre les tokens invalides et envoie uniquement les valides', async () => {
      mockIsExpoPushToken.mockImplementation(
        (token: string) => token === 'good-token',
      );
      mockChunkPushNotifications.mockReturnValue([[{ to: 'good-token' }]]);
      mockSendPushNotificationsAsync.mockResolvedValue([{ status: 'ok' }]);

      const result = await service.sendMulticast({
        tokens: ['bad-token', 'good-token'],
        title: 'Titre',
        body: 'Corps',
      });

      expect(mockChunkPushNotifications).toHaveBeenCalledWith([
        expect.objectContaining({ to: 'good-token', priority: 'high' }),
      ]);
      expect(result).toEqual({ successCount: 1, failureCount: 0 });
    });

    it('compte correctement les succès et échecs parmi les receipts', async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      mockChunkPushNotifications.mockReturnValue([
        [{ to: 'token-1' }, { to: 'token-2' }, { to: 'token-3' }],
      ]);
      mockSendPushNotificationsAsync.mockResolvedValue([
        { status: 'ok' },
        { status: 'error', message: 'DeviceNotRegistered' },
        { status: 'ok' },
      ]);

      const result = await service.sendMulticast({
        tokens: ['token-1', 'token-2', 'token-3'],
        title: 'Titre',
        body: 'Corps',
      });

      expect(result).toEqual({ successCount: 2, failureCount: 1 });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DeviceNotRegistered'),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('total: 3'),
      );
    });

    it('agrège les compteurs à travers plusieurs chunks', async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      mockChunkPushNotifications.mockReturnValue([
        [{ to: 'token-1' }],
        [{ to: 'token-2' }],
      ]);
      mockSendPushNotificationsAsync
        .mockResolvedValueOnce([{ status: 'ok' }])
        .mockResolvedValueOnce([{ status: 'error', message: 'Boom' }]);

      const result = await service.sendMulticast({
        tokens: ['token-1', 'token-2'],
        title: 'Titre',
        body: 'Corps',
      });

      expect(mockSendPushNotificationsAsync).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ successCount: 1, failureCount: 1 });
    });

    it('retourne null et logue une erreur en cas d’exception', async () => {
      mockIsExpoPushToken.mockReturnValue(true);
      mockChunkPushNotifications.mockReturnValue([[{ to: 'token-1' }]]);
      mockSendPushNotificationsAsync.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.sendMulticast({
        tokens: ['token-1'],
        title: 'Titre',
        body: 'Corps',
      });

      expect(result).toBeNull();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Échec multicast push',
        expect.any(Error),
      );
    });
  });
});

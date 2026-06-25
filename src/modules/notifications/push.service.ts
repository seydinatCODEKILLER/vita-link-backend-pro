import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushToken } from 'expo-server-sdk';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly expo = new Expo();

  async sendToOne(payload: {
    token: ExpoPushToken;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    if (!Expo.isExpoPushToken(payload.token)) {
      this.logger.warn(
        `Push token invalide — envoi ignoré: ${String(payload.token)}`,
      );
      return;
    }

    const message: ExpoPushMessage = {
      to: payload.token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    };

    try {
      const chunks = this.expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        const receipts = await this.expo.sendPushNotificationsAsync(chunk);
        for (const receipt of receipts) {
          if (receipt.status === 'error') {
            this.logger.error(`Erreur push: ${String(receipt.message)}`);
          }
        }
      }
    } catch (err) {
      this.logger.error('Échec envoi push unitaire', err);
    }
  }

  async sendMulticast(payload: {
    tokens: ExpoPushToken[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<{ successCount: number; failureCount: number } | null> {
    if (!payload.tokens.length) return null;

    const validTokens = payload.tokens.filter((token) => {
      const isValid = Expo.isExpoPushToken(token);
      if (!isValid)
        this.logger.warn(`Token Expo invalide filtré: ${String(token)}`);
      return isValid;
    });

    if (!validTokens.length) return null;

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      priority: 'high',
    }));

    let successCount = 0;
    let failureCount = 0;

    try {
      const chunks = this.expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        const receipts = await this.expo.sendPushNotificationsAsync(chunk);
        for (const receipt of receipts) {
          if (receipt.status === 'error') {
            failureCount++;
            this.logger.error(
              `Erreur push multicast: ${String(receipt.message)}`,
            );
          } else {
            successCount++;
          }
        }
      }

      this.logger.log(
        `Multicast — total: ${validTokens.length} — ok: ${successCount} — ko: ${failureCount}`,
      );

      return { successCount, failureCount };
    } catch (err) {
      this.logger.error('Échec multicast push', err);
      return null;
    }
  }
}

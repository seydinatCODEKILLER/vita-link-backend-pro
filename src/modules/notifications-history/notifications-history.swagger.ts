import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

const NOTIFICATION_EXAMPLE = {
  id: 'uuid-notification',
  type: 'ALERT_NEW',
  channel: 'PUSH_EXPO',
  payload: '{"alertId":"uuid-alert","bloodType":"O_NEG"}',
  status: 'DELIVERED',
  isRead: false,
  sentAt: '2026-06-25T10:00:00.000Z',
  createdAt: '2026-06-25T10:00:00.000Z',
  alert: { id: 'uuid-alert', bloodType: 'O_NEG', urgencyLevel: 'VITAL' },
};

export const ApiGetMyNotifications = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mes notifications',
      description:
        "Retourne l'historique paginé des notifications de l'utilisateur " +
        'connecté, triées par date décroissante. Filtrable par statut de ' +
        'lecture via `isRead`.',
    }),
    ApiQuery({
      name: 'isRead',
      required: false,
      enum: ['true', 'false'],
      description:
        'Filtrer par statut de lecture (ex: false pour les non lues)',
    }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des notifications récupérée avec succès',
      schema: {
        example: {
          success: true,
          notifications: [NOTIFICATION_EXAMPLE],
          pagination: { total: 12, page: 1, limit: 20, totalPages: 1 },
        },
      },
    }),
  );

export const ApiMarkAsRead = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Marquer une notification comme lue',
      description:
        'Passe le statut `isRead` à `true`. Un utilisateur ne peut marquer ' +
        'que ses propres notifications. Si la notification est déjà lue, ' +
        'elle est retournée sans nouvelle écriture en base.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notification mise à jour',
      schema: {
        example: {
          success: true,
          notification: { ...NOTIFICATION_EXAMPLE, isRead: true },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Notification appartenant à un autre utilisateur',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Notification introuvable',
    }),
  );

export const ApiDeleteAllMyNotifications = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Supprimer toutes mes notifications',
      description:
        "Supprime définitivement toutes les notifications de l'utilisateur " +
        'connecté. Action irréversible.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Notifications supprimées',
      schema: {
        example: {
          success: true,
          message: 'Toutes vos notifications ont été supprimées',
          deletedCount: 15,
        },
      },
    }),
  );

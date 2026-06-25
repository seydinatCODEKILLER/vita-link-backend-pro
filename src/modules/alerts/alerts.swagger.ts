import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateAlertDto } from './dto/create-alert.dto';

export const ApiCreateAlert = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Créer une alerte sanguine',
      description:
        'Déclenche une alerte médicale en temps réel :\n\n' +
        "1. Crée l'alerte en base de données\n" +
        '2. Identifie les donneurs compatibles dans le rayon via **Haversine SQL**\n' +
        '3. Envoie un **broadcast Socket.io** aux donneurs connectés\n' +
        '4. Envoie des **push notifications Expo** aux donneurs hors-ligne\n\n' +
        'Réservé aux agents de santé dont la structure est **vérifiée**.\n\n' +
        'Expiration auto-calculée si non fournie : **VITAL → 1h**, **STANDARD → 4h**.',
    }),
    ApiBody({ type: CreateAlertDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Alerte créée et donneurs notifiés',
      schema: {
        example: {
          success: true,
          data: {
            alert: {
              id: 'uuid-alert',
              bloodType: 'O_NEG',
              quantityNeeded: 2,
              quantityConfirmed: 0,
              urgencyLevel: 'VITAL',
              status: 'ACTIVE',
              serviceUnit: 'EMERGENCY_ROOM',
              address: 'Avenue Nelson Mandela, Dakar',
              latitude: 14.6937,
              longitude: -17.4441,
              radiusKm: 10,
              expiresAt: '2026-06-14T11:00:00.000Z',
              createdAt: '2026-06-14T10:00:00.000Z',
              healthStructure: {
                id: 'uuid-structure',
                name: 'Hôpital Principal de Dakar',
              },
            },
            notifiedDonors: 12,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Données invalides ou coordonnées manquantes',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Structure non vérifiée ou rôle insuffisant',
    }),
  );

export const ApiGetNearbyAlerts = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Alertes actives autour du donneur',
      description:
        'Retourne les alertes actives dans un rayon donné, triées par :\n\n' +
        '1. Urgence (VITAL avant STANDARD)\n' +
        '2. Distance croissante\n\n' +
        'Si `lat`/`lng` ne sont pas fournis, utilise les coordonnées enregistrées dans le profil du donneur.',
    }),
    ApiQuery({
      name: 'lat',
      required: false,
      type: Number,
      example: 14.6937,
      description: 'Latitude du donneur',
    }),
    ApiQuery({
      name: 'lng',
      required: false,
      type: Number,
      example: -17.4441,
      description: 'Longitude du donneur',
    }),
    ApiQuery({
      name: 'radius',
      required: false,
      type: Number,
      example: 15,
      description: 'Rayon de recherche en km (max 100)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des alertes actives à proximité',
      schema: {
        example: {
          success: true,
          data: [
            {
              id: 'uuid-alert',
              bloodType: 'O_NEG',
              quantityNeeded: 2,
              quantityConfirmed: 0,
              urgencyLevel: 'VITAL',
              status: 'ACTIVE',
              serviceUnit: 'EMERGENCY_ROOM',
              address: 'Avenue Nelson Mandela, Dakar',
              latitude: 14.6937,
              longitude: -17.4441,
              radiusKm: 10,
              expiresAt: '2026-06-14T11:00:00.000Z',
              createdAt: '2026-06-14T10:00:00.000Z',
              distance_km: 1.4,
              healthStructure: {
                id: 'uuid-structure',
                name: 'Hôpital Principal de Dakar',
                address: 'Avenue Nelson Mandela, Dakar',
                latitude: 14.6937,
                longitude: -17.4441,
              },
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Coordonnées manquantes (ni en query ni dans le profil)',
    }),
  );

export const ApiGetMyStructureAlerts = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Alertes de ma structure',
      description:
        "Historique paginé des alertes émises par la structure de l'agent connecté. " +
        'Filtrable par statut.\n\n' +
        '⚠️ Cette route doit être déclarée **avant** `/:id` pour éviter les conflits de routing.',
    }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 20,
      description: 'Max 50',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['ACTIVE', 'QUOTA_REACHED', 'EXPIRED', 'CANCELLED'],
      description: 'Filtrer par statut',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste paginée des alertes de la structure',
      schema: {
        example: {
          success: true,
          data: {
            alerts: [
              {
                id: 'uuid-alert',
                bloodType: 'A_POS',
                urgencyLevel: 'STANDARD',
                status: 'QUOTA_REACHED',
                quantityNeeded: 3,
                quantityConfirmed: 3,
                createdAt: '2026-06-14T08:00:00.000Z',
                _count: { alertResponses: 5 },
              },
            ],
            pagination: { total: 42, page: 1, limit: 20, totalPages: 3 },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Non rattaché à une structure',
    }),
  );

export const ApiGetAlertById = () =>
  applyDecorators(
    ApiOperation({
      summary: "Détail d'une alerte",
      description:
        "Retourne toutes les informations d'une alerte. Accessible à tous les utilisateurs authentifiés.",
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: "Détail de l'alerte",
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid-alert',
            bloodType: 'O_NEG',
            quantityNeeded: 2,
            quantityConfirmed: 1,
            urgencyLevel: 'VITAL',
            status: 'ACTIVE',
            serviceUnit: 'EMERGENCY_ROOM',
            address: 'Avenue Nelson Mandela, Dakar',
            latitude: 14.6937,
            longitude: -17.4441,
            radiusKm: 10,
            expiresAt: '2026-06-14T11:00:00.000Z',
            closedAt: null,
            createdAt: '2026-06-14T10:00:00.000Z',
            updatedAt: '2026-06-14T10:15:00.000Z',
            healthStructure: { id: 'uuid', name: 'Hôpital Principal de Dakar' },
            createdBy: {
              id: 'uuid-user',
              firstName: 'Dr. Moussa',
              lastName: 'Sow',
            },
            _count: { alertResponses: 3 },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Alerte introuvable',
    }),
  );

export const ApiGetAlertResponses = () =>
  applyDecorators(
    ApiOperation({
      summary: "Réponses en temps réel d'une alerte (Dashboard médecin)",
      description:
        "Retourne la liste des donneurs ayant répondu à l'alerte avec leur statut. " +
        'Accessible uniquement au personnel de la structure émettrice ou aux admins.\n\n' +
        'Pour le temps réel, le client doit rejoindre la room Socket.io `alert:{id}`.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Réponses et résumé',
      schema: {
        example: {
          success: true,
          data: {
            alert: {
              id: 'uuid-alert',
              bloodType: 'O_NEG',
              urgencyLevel: 'VITAL',
              status: 'ACTIVE',
            },
            summary: { confirmed: 3, arrived: 1, declined: 2, noShow: 0 },
            responses: [
              {
                id: 'uuid-response',
                status: 'ARRIVED',
                etaMinutes: 8,
                respondedAt: '2026-06-14T10:05:00.000Z',
                arrivedAt: '2026-06-14T10:13:00.000Z',
                donor: {
                  id: 'uuid-donor',
                  firstName: 'Aliou',
                  lastName: 'Diallo',
                  bloodType: 'O_NEG',
                  phone: '+221771234567',
                },
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès refusé — autre structure',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Alerte introuvable',
    }),
  );

export const ApiCloseAlert = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Fermer manuellement une alerte',
      description:
        "Passe l'alerte au statut `CANCELLED` et enregistre la date de fermeture (`closedAt`).\n\n" +
        'Émet les événements Socket.io :\n' +
        '- `alert:closed` sur la room `alert:{id}`\n' +
        '- `alert:closed` sur la room `structure:{id}`\n\n' +
        "Seul le personnel de la structure émettrice ou un admin peut fermer l'alerte.\n\n" +
        '⚠️ Une alerte déjà `CANCELLED`, `EXPIRED` ne peut pas être fermée à nouveau.',
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte à fermer",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Alerte fermée avec succès',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid-alert',
            status: 'CANCELLED',
            closedAt: '2026-06-14T10:30:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Alerte déjà fermée, expirée ou quota atteint',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès refusé — autre structure ou rôle insuffisant',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Alerte introuvable',
    }),
  );

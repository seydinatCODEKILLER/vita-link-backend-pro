import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { ConfirmResponseDto } from './dto/confirm-response.dto';
import { AgentActionDto } from './dto/agent-action.dto';

export const ApiCheckActiveConfirmation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Vérifie si le donneur a une confirmation active',
      description:
        'Retourne `hasActiveConfirmation: true` si le donneur a confirmé ("J\'y vais") ' +
        'une alerte qui est toujours en cours (ACTIVE). ' +
        'Permet au mobile de désactiver le bouton "J\'y vais" sur les autres alertes.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: "Statut de l'engagement du donneur",
      schema: {
        example: {
          success: true,
          data: {
            hasActiveConfirmation: true,
            activeResponse: {
              id: 'uuid-response',
              alertId: 'uuid-alert',
              status: 'CONFIRMED',
              qrCode: 'VITA-X9K2-M4P7',
              etaMinutes: 12,
              respondedAt: '2026-06-14T10:05:00.000Z',
            },
          },
        },
      },
    }),
  );

export const ApiConfirmResponse = () =>
  applyDecorators(
    ApiOperation({
      summary: "J'y vais — Confirmation du donneur",
      description:
        "Le donneur confirme sa venue. Génère un QR Code unique qui sera scanné par l'hôpital.\n\n" +
        "Si le quota est atteint, l'alerte passe automatiquement en `QUOTA_REACHED` " +
        '(sans fermeture définitive — des remplaçants peuvent encore être acceptés en cas de No-Show).',
    }),
    ApiParam({
      name: 'alertId',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiBody({ type: ConfirmResponseDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Confirmation enregistrée avec QR Code',
      schema: {
        example: {
          success: true,
          data: {
            message:
              "Confirmation enregistrée. Présentez ce QR Code à l'accueil de l'hôpital.",
            qrCode: 'VITA-X9K2-M4P7',
            isQuotaReached: false,
            response: {
              id: 'uuid-response',
              alertId: 'uuid-alert',
              status: 'CONFIRMED',
              etaMinutes: 12,
              respondedAt: '2026-06-14T10:05:00.000Z',
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Alerte expirée, déjà acceptée ou donneur non éligible',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Alerte introuvable',
    }),
  );

export const ApiDeclineResponse = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Pas disponible — Refus du donneur',
      description:
        "Le donneur signale qu'il n'est pas disponible pour cette alerte. " +
        'Son statut passe à `DECLINED`. ' +
        "Cette action est informative et n'affecte pas le quota de l'alerte.",
    }),
    ApiParam({
      name: 'alertId',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Refus enregistré',
      schema: {
        example: {
          success: true,
          data: { message: 'Votre refus a été pris en compte.' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Aucune réponse à décliner',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Alerte introuvable',
    }),
  );

export const ApiMarkArrived = () =>
  applyDecorators(
    ApiOperation({
      summary: "Marquer l'arrivée du donneur — Agent de santé",
      description:
        "L'agent de santé confirme l'arrivée physique d'un donneur à l'hôpital. " +
        'Le donneur doit avoir préalablement confirmé sa venue (statut `CONFIRMED`).\n\n' +
        'Émet un événement Socket.io `donor:arrived` sur la room `alert:{id}`.',
    }),
    ApiParam({
      name: 'alertId',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiBody({ type: AgentActionDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Arrivée confirmée',
      schema: {
        example: {
          success: true,
          data: {
            message: 'Arrivée confirmée. Scannez le QR Code du donneur.',
            response: {
              id: 'uuid-response',
              status: 'ARRIVED',
              arrivedAt: '2026-06-14T10:13:00.000Z',
              donor: {
                id: 'uuid-donor',
                firstName: 'Aliou',
                lastName: 'Diallo',
                bloodType: 'O_NEG',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "Le donneur n'a pas confirmé sa venue au préalable",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Aucune réponse trouvée pour ce donneur sur cette alerte',
    }),
  );

export const ApiMarkNoShow = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Signaler une absence (No-Show) — Agent de santé',
      description:
        "L'agent de santé signale qu'un donneur ne s'est pas présenté.\n\n" +
        '**Effets en cascade :**\n' +
        '- Statut de la réponse → `NO_SHOW`\n' +
        '- Incrémente le compteur de No-Show du donneur\n' +
        "- Décrémente le quota confirmé de l'alerte\n" +
        '- Si quota non atteint → alerte automatiquement réouverte (`ACTIVE`)\n' +
        '- Notifie la structure en temps réel via Socket.io `alert:reactivated`',
    }),
    ApiParam({
      name: 'alertId',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiBody({ type: AgentActionDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Signalement enregistré et quota ajusté',
      schema: {
        example: {
          success: true,
          data: {
            message:
              "Signalement enregistré. Le système va ajuster le quota de l'alerte.",
            alertReactivated: true,
            response: {
              id: 'uuid-response',
              status: 'NO_SHOW',
              donor: {
                id: 'uuid-donor',
                firstName: 'Aliou',
                lastName: 'Diallo',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "Action impossible — le donneur n'avait pas confirmé",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Aucune réponse trouvée pour ce donneur sur cette alerte',
    }),
  );

export const ApiCancelConfirmation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Annuler sa confirmation — Donneur',
      description:
        'Le donneur annule sa confirmation ("J\'y vais") pour une alerte.\n\n' +
        '**Effets en cascade :**\n' +
        '- Statut de la réponse → `CANCELLED`\n' +
        "- Décrémente le quota confirmé de l'alerte\n" +
        '- Si quota non atteint → alerte automatiquement réouverte (`ACTIVE`)\n' +
        "- L'hôpital est notifié en temps réel via Socket.io",
    }),
    ApiParam({
      name: 'alertId',
      type: String,
      format: 'uuid',
      description: "UUID de l'alerte",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Annulation enregistrée',
      schema: {
        example: {
          success: true,
          data: {
            message: 'Votre confirmation a été annulée.',
            alertReactivated: false,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "La réponse n'était pas en statut CONFIRMED",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Réponse introuvable',
    }),
  );

import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ConfirmExpiryDto } from './dto/confirm-expiry.dto';

const PURCHASE_ORDER_EXAMPLE = {
  id: 'uuid-purchase-order',
  code: 'CMD-X9K2-M4P7',
  bloodType: 'O_NEG',
  quantity: 3,
  status: 'PENDING',
  expiresAt: '2026-06-26T10:00:00.000Z',
  scannedAt: null,
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
  bloodRequest: {
    id: 'uuid-request',
    urgencyLevel: 'VITAL',
    serviceUnit: 'EMERGENCY_ROOM',
  },
  cnts: {
    id: 'uuid-cnts',
    name: 'CNTS de Dakar',
    address: 'Route de Rufisque, Dakar',
  },
  hospital: {
    id: 'uuid-hospital',
    name: 'Hôpital Principal',
    address: 'Avenue Cheikh Anta Diop, Dakar',
  },
  scannedBy: null,
};

export const ApiGetPurchaseOrders = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste des bons de commande',
      description:
        "Retourne les bons de commande en fonction du rôle de l'utilisateur connecté :\n\n" +
        '- **CNTS** : voit les bons qu’elle a émis.\n' +
        '- **Hôpital** : voit les bons qui lui sont destinés.\n\n' +
        'Un `PurchaseOrder` est créé automatiquement lorsqu’une demande de sang ' +
        'est traitée avec `FULFILL` ou `PARTIALLY_FULFILL` (voir module Blood Requests). ' +
        'Il matérialise la remise physique des poches : un code (`CMD-XXXX-XXXX`) ' +
        'est scanné par la CNTS au moment de la livraison pour confirmer la remise.',
    }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['PENDING', 'USED', 'EXPIRED', 'CANCELLED'],
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste paginée des bons de commande',
      schema: {
        example: {
          success: true,
          orders: [PURCHASE_ORDER_EXAMPLE],
          pagination: { total: 5, page: 1, limit: 20, totalPages: 1 },
        },
      },
    }),
  );

export const ApiScanPurchaseOrder = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Scanner un bon de commande (CNTS)',
      description:
        "Permet à un agent de la CNTS de scanner le code d'un bon de commande " +
        "(`CMD-XXXX-XXXX`) au moment de la remise physique des poches à l'hôpital. " +
        'Le bon passe au statut `USED`. Un bon déjà utilisé, expiré ou annulé ' +
        'ne peut plus être scanné.',
    }),
    ApiParam({ name: 'code', example: 'CMD-X9K2-M4P7' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Bon de commande validé',
      schema: {
        example: {
          success: true,
          message: 'Bon de commande validé. La remise du sang est confirmée.',
          order: {
            ...PURCHASE_ORDER_EXAMPLE,
            status: 'USED',
            scannedAt: '2026-06-26T09:00:00.000Z',
            scannedBy: { id: 'uuid-agent', firstName: 'Awa', lastName: 'Diop' },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Le bon a déjà été utilisé, a expiré, ou a été annulé',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Ce bon de commande n'appartient pas à votre CNTS",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Bon de commande introuvable',
    }),
  );

export const ApiConfirmExpiry = () =>
  applyDecorators(
    ApiOperation({
      summary: "Confirmer l'expiration d'un bon",
      description:
        "Permet à la CNTS de confirmer manuellement le sort d'un bon de commande " +
        'passé au statut `EXPIRED` (non scanné avant `expiresAt`) :\n\n' +
        '- `wasDelivered: true` → le bon est marqué `USED` rétroactivement ' +
        '(la remise a bien eu lieu mais le scan a été omis).\n' +
        '- `wasDelivered: false` → le bon est marqué `CANCELLED` et le stock ' +
        'CNTS correspondant est **recrédité** automatiquement.',
    }),
    ApiBody({ type: ConfirmExpiryDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Expiration confirmée',
      schema: {
        example: {
          success: true,
          message:
            'Bon confirmé comme non remis. Le stock CNTS a été recrédité.',
          order: { ...PURCHASE_ORDER_EXAMPLE, status: 'CANCELLED' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Seuls les bons au statut EXPIRED nécessitent cette confirmation',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Vous n'êtes pas autorisé à confirmer ce bon",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Bon de commande introuvable',
    }),
  );

export const ApiGetPurchaseOrderByBloodRequest = () =>
  applyDecorators(
    ApiOperation({
      summary: "Bon de commande d'une demande (Hôpital)",
      description:
        'Retourne le bon de commande associé à une demande de sang donnée, ' +
        "permettant à l'hôpital de suivre la remise (code, statut, expiration).",
    }),
    ApiParam({ name: 'bloodRequestId', format: 'uuid' }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Bon de commande trouvé',
      schema: { example: { success: true, order: PURCHASE_ORDER_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès refusé à ce bon de commande',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Bon de commande introuvable',
    }),
  );

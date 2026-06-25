import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { UpdateStockDto } from './dto/update-stock.dto';

export const ApiGetMyStocks = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Stock de sang de ma structure',
      description:
        "Retourne l'état des stocks pour les 8 groupes sanguins de la structure connectée.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'État des stocks récupéré avec succès',
      schema: {
        example: {
          success: true,
          data: [
            { bloodType: 'O_NEG', quantity: 2, level: 'LOW' },
            { bloodType: 'A_POS', quantity: 0, level: 'CRITICAL' },
            { bloodType: 'B_POS', quantity: 10, level: 'ADEQUATE' },
            { bloodType: 'AB_NEG', quantity: 20, level: 'SURPLUS' },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Non rattaché à une structure',
    }),
  );

export const ApiUpdateMyStock = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mettre à jour un stock manuellement',
      description:
        "Permet à l'agent CNTS de mettre à jour la quantité de poches disponibles pour un groupe sanguin. " +
        "Le système **calcule automatiquement le niveau d'alerte** :\n\n" +
        '- `0` → **CRITICAL**\n' +
        '- `1 à 5` → **LOW**\n' +
        '- `6 à 15` → **ADEQUATE**\n' +
        '- `16+` → **SURPLUS**\n\n' +
        'Émet un événement Socket.io `stock:updated` à la structure. ' +
        'Si CRITICAL, émet `stock:critical` aux admins globaux.',
    }),
    ApiBody({ type: UpdateStockDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Stock mis à jour avec succès',
      schema: {
        example: {
          success: true,
          data: {
            bloodType: 'O_NEG',
            quantity: 4,
            level: 'LOW',
            updatedAt: '2026-06-14T10:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux agents CNTS',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Non rattaché à une structure',
    }),
  );

export const ApiGetAllStocks = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Stocks de toutes les structures (Admin)',
      description:
        "Vue globale pour l'administrateur de tous les stocks de sang. " +
        "Filtrable par niveau d'alerte (ex: uniquement les stocks CRITICAL).",
    }),
    ApiQuery({
      name: 'level',
      required: false,
      enum: ['CRITICAL', 'LOW', 'ADEQUATE', 'SURPLUS'],
      description: 'Filtrer par niveau de stock',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Numéro de page',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 50,
      description: 'Nombre de résultats par page',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste paginée des stocks',
      schema: {
        example: {
          success: true,
          data: [
            {
              id: 'uuid',
              bloodType: 'O_NEG',
              quantity: 0,
              level: 'CRITICAL',
              healthStructure: {
                id: 'uuid-structure',
                name: 'CNTS de Dakar',
                region: 'Dakar',
              },
              updatedAt: '2026-06-14T10:00:00.000Z',
            },
          ],
          meta: { total: 42, page: 1, limit: 50 },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès réservé aux admins',
    }),
  );

import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export const ApiGetCntsDashboard = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Tableau de bord CNTS',
      description:
        'Retourne les KPIs et données du dashboard pour la CNTS connectée :\n\n' +
        '- **KPIs** : demandes en attente, stock critique, alertes actives, total dons\n' +
        '- **Stock** : état des réserves de sang de la CNTS\n' +
        '- **Demandes** : les dernières demandes des hôpitaux affiliés à traiter\n\n' +
        'Réservé aux agents de la CNTS.',
    }),
    ApiQuery({
      name: 'recentRequestsLimit',
      required: false,
      type: Number,
      example: 5,
      description: 'Nombre de demandes récentes à retourner (max 20)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Données du dashboard CNTS',
      schema: {
        example: {
          success: true,
          dashboard: {
            kpis: {
              pendingRequests: 4,
              criticalStocks: 2,
              activeAlerts: 1,
              totalDonations: 150,
            },
            bloodStocks: [
              { bloodType: 'O_NEG', quantity: 2, level: 'LOW' },
              { bloodType: 'A_POS', quantity: 0, level: 'CRITICAL' },
            ],
            recentRequests: [
              {
                id: 'uuid-request',
                bloodType: 'O_NEG',
                quantityNeeded: 3,
                urgencyLevel: 'VITAL',
                status: 'PENDING',
                createdAt: '2026-06-25T10:00:00.000Z',
                requestingHospital: {
                  id: 'uuid-hospital',
                  name: 'Hôpital Principal',
                  region: 'Dakar',
                },
              },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Non autorisé (l'utilisateur n'est pas rattaché à une CNTS)",
    }),
  );

export const ApiGetHospitalDashboard = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Tableau de bord Hôpital',
      description:
        "Retourne les KPIs et données du dashboard pour l'établissement de " +
        'soins connecté (hôpital ou centre de santé) :\n\n' +
        '- **KPIs** : demandes en attente vers la CNTS, alertes directes, total dons\n' +
        '- **Mes demandes** : les dernières demandes de sang en cours\n' +
        "- **Stock CNTS** : l'état des réserves de la CNTS d'affiliation (lecture seule)\n\n" +
        'Réservé aux établissements de soins (hôpital, centre de santé).',
    }),
    ApiQuery({
      name: 'myRequestsLimit',
      required: false,
      type: Number,
      example: 5,
      description: 'Nombre de mes demandes récentes à retourner (max 20)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Données du dashboard Hôpital',
      schema: {
        example: {
          success: true,
          dashboard: {
            kpis: {
              pendingRequests: 2,
              activeDirectAlerts: 0,
              totalDonations: 45,
            },
            myRequests: [
              {
                id: 'uuid-request',
                bloodType: 'O_NEG',
                quantityNeeded: 3,
                quantityProvided: 1,
                status: 'PARTIALLY_FULFILLED',
                urgencyLevel: 'VITAL',
                createdAt: '2026-06-25T10:00:00.000Z',
              },
            ],
            cntsStock: [{ bloodType: 'O_NEG', quantity: 2, level: 'LOW' }],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description:
        "Non autorisé (l'utilisateur n'est pas rattaché à un hôpital)",
    }),
  );

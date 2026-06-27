import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { HandleBloodRequestDto } from './dto/handle-blood-request.dto';

export const ApiCreateBloodRequest = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Créer une demande de sang (Hôpital)',
      description:
        'Un agent hospitalier soumet une demande de sang à la CNTS à laquelle ' +
        'son établissement est affilié. La CNTS est automatiquement déterminée ' +
        "selon l'affiliation de l'hôpital. La demande est créée avec le statut " +
        '`PENDING` et la CNTS est notifiée en temps réel.',
    }),
    ApiBody({ type: CreateBloodRequestDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Demande créée et transmise à la CNTS',
      schema: {
        example: {
          success: true,
          request: {
            id: 'uuid-request',
            bloodType: 'O_NEG',
            quantityNeeded: 3,
            quantityProvided: 0,
            urgencyLevel: 'VITAL',
            serviceUnit: 'EMERGENCY_ROOM',
            clinicalContext:
              'Hémorragie post-opératoire, patient en état de choc.',
            status: 'PENDING',
            cntsNotes: null,
            escalatedAlertId: null,
            fulfilledAt: null,
            createdAt: '2026-06-25T10:00:00.000Z',
            updatedAt: '2026-06-25T10:00:00.000Z',
            requestingHospital: {
              id: 'uuid-hospital',
              name: 'Hôpital Principal',
              address: 'Avenue Cheikh Anta Diop, Dakar',
              region: 'Dakar',
            },
            requestedBy: {
              id: 'uuid-user',
              firstName: 'Moussa',
              lastName: 'Fall',
            },
            handledByCnts: {
              id: 'uuid-cnts',
              name: 'CNTS de Dakar',
              region: 'Dakar',
            },
            handledBy: null,
            escalatedAlert: null,
            purchaseOrder: null,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Données invalides ou hôpital non affilié à une CNTS',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès refusé (rôle non hospitalier, ou structure CNTS)',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Structure introuvable',
    }),
  );

export const ApiGetBloodRequests = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste des demandes de sang',
      description:
        "Retourne les demandes de sang en fonction du rôle de l'utilisateur connecté :\n\n" +
        '- **Hôpital** : voit uniquement les demandes émises par son établissement.\n' +
        '- **CNTS** : voit uniquement les demandes adressées à sa structure.\n' +
        '- **Admin** : voit toutes les demandes (selon implémentation du repository).',
    }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: [
        'PENDING',
        'FULFILLED',
        'PARTIALLY_FULFILLED',
        'ESCALATED_TO_ALERT',
        'REJECTED',
        'CANCELLED',
      ],
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste paginée des demandes',
      schema: {
        example: {
          success: true,
          requests: [
            {
              id: 'uuid-request',
              bloodType: 'O_NEG',
              quantityNeeded: 3,
              quantityProvided: 0,
              urgencyLevel: 'VITAL',
              status: 'PENDING',
              createdAt: '2026-06-25T10:00:00.000Z',
            },
          ],
          pagination: { total: 12, page: 1, limit: 20, totalPages: 1 },
        },
      },
    }),
  );

export const ApiHandleBloodRequest = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Traiter une demande de sang (CNTS)',
      description:
        'Permet à un agent de la CNTS de traiter une demande en attente (`PENDING`).\n' +
        'Plusieurs actions sont possibles selon le stock disponible :\n\n' +
        '- `FULFILL` : le stock est suffisant, on fournit tout. Génère un ' +
        '`PurchaseOrder` (bon de commande/poche scannable) pour l’hôpital.\n' +
        '- `PARTIALLY_FULFILL` : fournit une partie (génère aussi un ' +
        '`PurchaseOrder` pour la quantité fournie) et déclenche une alerte ' +
        'donneurs pour le reste (nécessite `quantityProvided`).\n' +
        '- `ESCALATE` : aucun stock, déclenche une alerte donneurs pour toute la quantité.\n' +
        '- `REJECT` : la CNTS refuse la demande.\n\n' +
        'Pour `FULFILL`, `PARTIALLY_FULFILL` et `ESCALATE`, les effets de bord ' +
        '(création du bon de commande et/ou de l’alerte) sont traités via des ' +
        'événements internes **attendus avant la réponse HTTP** : ' +
        '`purchaseOrder` et `escalatedAlertId` sont donc garantis présents ' +
        'dans la réponse si leur création a réussi.',
    }),
    ApiBody({ type: HandleBloodRequestDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Demande traitée avec succès',
      schema: {
        example: {
          success: true,
          request: {
            id: 'uuid-request',
            bloodType: 'O_NEG',
            quantityNeeded: 3,
            quantityProvided: 1,
            urgencyLevel: 'VITAL',
            status: 'PARTIALLY_FULFILLED',
            cntsNotes:
              'Stock partiel disponible, recherche en cours pour le reliquat.',
            escalatedAlertId: 'uuid-alert',
            fulfilledAt: null,
            handledBy: { id: 'uuid-agent', firstName: 'Awa', lastName: 'Diop' },
            purchaseOrder: {
              id: 'uuid-purchase-order',
              code: 'CMD-X9K2-M4P7',
              bloodType: 'O_NEG',
              quantity: 1,
              status: 'PENDING',
              expiresAt: '2026-06-26T10:00:00.000Z',
              scannedAt: null,
              cnts: {
                id: 'uuid-cnts',
                name: 'CNTS de Dakar',
                address: 'Route de Rufisque, Dakar',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Action invalide, stock insuffisant ou demande déjà traitée (statut ≠ PENDING)',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "La demande n'est pas adressée à votre CNTS",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Demande introuvable',
    }),
  );

export const ApiCancelBloodRequest = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Annuler une demande de sang (Hôpital)',
      description:
        "Permet à l'hôpital qui a émis la demande d'annuler celle-ci. " +
        'Seules les demandes avec le statut `PENDING` peuvent être annulées.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Demande annulée avec succès',
      schema: {
        example: {
          success: true,
          request: { id: 'uuid-request', status: 'CANCELLED' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'La demande ne peut plus être annulée (déjà traitée)',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Seul l'hôpital demandeur peut annuler",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Demande introuvable',
    }),
  );

export const ApiGetBloodRequestById = () =>
  applyDecorators(
    ApiOperation({
      summary: "Détail d'une demande de sang",
      description:
        "Retourne les informations détaillées d'une demande, y compris " +
        "l'hôpital demandeur, la CNTS assignée, l'alerte associée s'il y a eu " +
        'escalade, et le bon de commande (`purchaseOrder`) le cas échéant.\n\n' +
        "Règle d'accès : l'hôpital ne voit que ses demandes, la CNTS ne voit " +
        'que les siennes.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Détails de la demande',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès refusé à cette demande',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Demande introuvable',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "L'identifiant fourni n'est pas un UUID valide",
    }),
  );

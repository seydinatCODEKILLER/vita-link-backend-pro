import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ScanDonationDto } from './dto/scan-donation.dto';

export const ApiScanDonation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Scanner un QR Code → Valider le don',
      description:
        "Point central du flux de donation. L'agent scanne le QR Code affiché " +
        'sur le téléphone du donneur. En une transaction atomique :\n\n' +
        '- Crée la **Donation** validée\n' +
        "- Passe l'`AlertResponse` à `ARRIVED`\n" +
        '- Crédite les **points Jambaar** (base + bonus urgence + bonus sang rare + bonus réactivité)\n' +
        '- Calcule et applique le **nouveau grade** si seuil atteint\n' +
        '- Met à jour `nextEligibilityAt` (90j hommes / 120j femmes)\n' +
        '- Incrémente le **stock de sang** de la structure (ou de la CNTS affiliée si agent hospitalier)\n' +
        '- Émet des événements **Socket.io** (donneur, structure, dashboard alerte)\n' +
        '- Envoie une **push notification** au donneur\n\n' +
        'Réservé aux agents de santé et admins.',
    }),
    ApiBody({ type: ScanDonationDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Don validé et points crédités',
      schema: {
        example: {
          success: true,
          message: 'Don validé avec succès. Points Jambaar crédités.',
          donation: {
            id: 'uuid-donation',
            isDone: true,
            pointsAwarded: 170,
            donatedAt: '2026-06-25T10:00:00.000Z',
            validatedAt: '2026-06-25T10:00:00.000Z',
            notes: 'Don sans incident',
            healthStructure: {
              id: 'uuid-structure',
              name: 'Hôpital Principal',
            },
            donor: {
              id: 'uuid-donor',
              firstName: 'Awa',
              lastName: 'Diop',
              bloodType: 'O_NEG',
              avatarUrl: null,
              phone: '+221770000000',
              jambaarsProfile: {
                id: 'uuid-profile',
                totalPoints: 790,
                currentGrade: 'AMBASSADEUR',
                donationCount: 4,
                livesSavedEstimate: 12,
                nextEligibilityAt: '2026-09-23T10:00:00.000Z',
              },
            },
          },
          jambaar: {
            pointsAwarded: 170,
            newTotalPoints: 790,
            newGrade: 'AMBASSADEUR',
            gradeChanged: true,
            nextEligibilityAt: '2026-09-23T10:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        "QR Code déjà utilisé pour valider un don, ou donneur n'ayant pas confirmé sa venue (statut DECLINED/NO_SHOW)",
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Ce QR Code appartient à une autre structure de santé',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'QR Code invalide ou introuvable',
    }),
  );

export const ApiGetMyDonations = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Historique de mes dons',
      description:
        'Retourne la liste paginée des dons effectués par le donneur connecté, ' +
        'avec les détails de chaque alerte associée. Réservé aux donneurs.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Historique des dons récupéré avec succès',
      schema: {
        example: {
          success: true,
          donations: [
            {
              id: 'uuid-donation',
              isDone: true,
              pointsAwarded: 170,
              donatedAt: '2026-06-25T10:00:00.000Z',
              validatedAt: '2026-06-25T10:00:00.000Z',
              notes: null,
              healthStructure: {
                id: 'uuid-structure',
                name: 'Hôpital Principal',
              },
              alertResponse: {
                qrCode: 'VITA-X9K2-M4P7',
                etaMinutes: 18,
                alert: {
                  id: 'uuid-alert',
                  bloodType: 'O_NEG',
                  urgencyLevel: 'CRITICAL',
                  serviceUnit: 'Urgences',
                  healthStructure: {
                    id: 'uuid-structure',
                    name: 'Hôpital Principal',
                    address: 'Avenue Cheikh Anta Diop, Dakar',
                  },
                },
              },
            },
          ],
          pagination: { total: 4, page: 1, limit: 20, totalPages: 1 },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
  );

export const ApiGetStructureDonations = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Dons validés par ma structure',
      description:
        'Historique paginé de tous les dons validés dans la structure de ' +
        "l'agent connecté. Inclut les informations sur le donneur et l'alerte associée.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Historique des dons de la structure récupéré avec succès',
      schema: {
        example: {
          success: true,
          donations: [
            {
              id: 'uuid-donation',
              isDone: true,
              pointsAwarded: 170,
              donatedAt: '2026-06-25T10:00:00.000Z',
              validatedAt: '2026-06-25T10:00:00.000Z',
              notes: 'Don sans incident',
              testResultsJson: null,
              healthStructure: {
                id: 'uuid-structure',
                name: 'Hôpital Principal',
              },
              donor: {
                id: 'uuid-donor',
                firstName: 'Awa',
                lastName: 'Diop',
                bloodType: 'O_NEG',
                avatarUrl: null,
                phone: '+221770000000',
              },
              validatedBy: {
                id: 'uuid-agent',
                firstName: 'Moussa',
                lastName: 'Fall',
              },
            },
          ],
          pagination: { total: 12, page: 1, limit: 20, totalPages: 1 },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Vous n'êtes rattaché à aucune structure",
    }),
  );

export const ApiGetDonationById = () =>
  applyDecorators(
    ApiOperation({
      summary: "Détail d'un don",
      description:
        "Retourne les détails complets d'un don. Un donneur ne peut consulter " +
        'que ses propres dons. Les agents et admins peuvent consulter tous les dons.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Détail du don récupéré avec succès',
      schema: {
        example: {
          success: true,
          id: 'uuid-donation',
          isDone: true,
          pointsAwarded: 170,
          donatedAt: '2026-06-25T10:00:00.000Z',
          validatedAt: '2026-06-25T10:00:00.000Z',
          notes: 'Don sans incident',
          testResultsJson: null,
          healthStructure: { id: 'uuid-structure', name: 'Hôpital Principal' },
          donor: {
            id: 'uuid-donor',
            firstName: 'Awa',
            lastName: 'Diop',
            bloodType: 'O_NEG',
            avatarUrl: null,
            phone: '+221770000000',
          },
          validatedBy: {
            id: 'uuid-agent',
            firstName: 'Moussa',
            lastName: 'Fall',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description:
        "Accès refusé (donneur consultant un don qui n'est pas le sien)",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Don introuvable',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "L'identifiant fourni n'est pas un UUID valide",
    }),
  );

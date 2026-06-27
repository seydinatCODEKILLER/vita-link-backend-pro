import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

const COUPON_EXAMPLE = {
  id: 'uuid-coupon',
  code: 'JAMBAAR-X9K2-M4P7',
  status: 'ACTIVE',
  usedAt: null,
  expiresAt: '2026-07-25T10:00:00.000Z',
  createdAt: '2026-06-25T10:00:00.000Z',
  reward: {
    id: 'uuid-reward',
    title: 'Ticket de bus gratuit',
    description: 'Valable 1 trajet sur la ligne Dakar-Diamniadio',
    rewardType: 'TRANSPORT_TICKET',
    partner: {
      id: 'uuid-partner',
      name: 'Orange Sonatel',
      logoUrl:
        'https://res.cloudinary.com/vita-link/partners/orange-sonatel.png',
    },
  },
};

export const ApiRedeemReward = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Échanger des points contre une récompense',
      description:
        'Débite les points Jambaar du donneur et génère un coupon unique ' +
        '(`JAMBAAR-XXXX-XXXX`), valable 30 jours. Vérifications appliquées : ' +
        'récompense active et non expirée, stock disponible (sauf récompense ' +
        'illimitée), et solde de points suffisant.\n\n' +
        'La cohérence est garantie au niveau transaction : si deux échanges ' +
        'concurrents épuisent le stock ou le solde de points en même temps, ' +
        'celui qui ferait passer le stock ou le solde sous 0 échoue avec un ' +
        'message dédié plutôt que de corrompre les données.\n\n' +
        'Réservé aux donneurs.',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Coupon généré avec succès',
      schema: { example: { success: true, coupon: COUPON_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Récompense indisponible (inactive, expirée, rupture de stock), ' +
        'points insuffisants, ou conflit de concurrence (stock/points ' +
        'épuisés entre la vérification et la validation finale)',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Récompense ou profil Jambaar introuvable',
    }),
  );

export const ApiGetMyCoupons = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mes coupons',
      description:
        'Retourne la liste paginée des coupons obtenus par le donneur ' +
        'connecté, filtrable par statut (`ACTIVE`, `USED`, `EXPIRED`, ' +
        '`CANCELLED`). Réservé aux donneurs.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Coupons récupérés avec succès',
      schema: {
        example: {
          success: true,
          coupons: [COUPON_EXAMPLE],
          pagination: { total: 3, page: 1, limit: 20, totalPages: 1 },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
  );

export const ApiUseCoupon = () =>
  applyDecorators(
    ApiOperation({
      summary: "Valider l'utilisation d'un coupon",
      description:
        'Marque un coupon comme utilisé (`USED`), typiquement scanné/validé ' +
        'par le partenaire au moment de la remise effective de la ' +
        'récompense. Seul le gestionnaire du partenaire concerné ' +
        '(`managedByUserId`) ou un admin peut valider un coupon.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Coupon validé avec succès',
      schema: {
        example: {
          success: true,
          coupon: {
            ...COUPON_EXAMPLE,
            status: 'USED',
            usedAt: '2026-06-26T09:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Le coupon a déjà été utilisé ou a expiré',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: "Vous n'êtes pas autorisé à valider ce coupon",
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Coupon introuvable',
    }),
  );

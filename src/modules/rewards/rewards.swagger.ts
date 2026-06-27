import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

const REWARD_PUBLIC_EXAMPLE = {
  id: 'uuid-reward',
  title: 'Ticket de bus gratuit',
  description: 'Valable 1 trajet sur la ligne Dakar-Diamniadio',
  pointsCost: 150,
  rewardType: 'TRANSPORT_TICKET',
  isUnlimited: false,
  expiresAt: '2025-12-31T23:59:59.000Z',
  partner: {
    id: 'uuid-partner',
    name: 'Orange Sonatel',
    logoUrl: 'https://res.cloudinary.com/vita-link/partners/orange-sonatel.png',
  },
};

const REWARD_ADMIN_EXAMPLE = {
  ...REWARD_PUBLIC_EXAMPLE,
  stockQuantity: 50,
  isActive: true,
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
};

export const ApiListRewards = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Catalogue des récompenses',
      description:
        'Retourne le catalogue des récompenses échangeables contre des ' +
        'points Jambaar. Les admins voient toutes les récompenses (actives, ' +
        'désactivées, épuisées, expirées). Les autres utilisateurs ne voient ' +
        'que celles réellement disponibles : actives, non expirées, et ' +
        'en stock (ou illimitées).',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Catalogue récupéré avec succès',
      schema: { example: { success: true, rewards: [REWARD_PUBLIC_EXAMPLE] } },
    }),
  );

export const ApiGetRewardById = () =>
  applyDecorators(
    ApiOperation({
      summary: "Détail d'une récompense",
      description:
        "Retourne les détails d'une récompense. Une récompense désactivée " +
        "n'est visible que par les admins (404 pour les autres rôles).",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Récompense trouvée',
      schema: { example: { success: true, reward: REWARD_ADMIN_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Récompense introuvable (ou désactivée pour un non-admin)',
    }),
  );

export const ApiCreateReward = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Créer une récompense (Admin)',
      description:
        'Crée une récompense active par défaut, liée à un partenaire ' +
        '(`partnerId`). Le coût en points (`pointsCost`) et le type ' +
        '(`rewardType`) sont obligatoires. Une récompense `isUnlimited: true` ' +
        'ignore `stockQuantity` pour la disponibilité.',
    }),
    ApiBody({ type: CreateRewardDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Récompense créée avec succès',
      schema: { example: { success: true, reward: REWARD_ADMIN_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Données invalides',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
  );

export const ApiUpdateReward = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Modifier une récompense (Admin)',
      description:
        'Met à jour partiellement une récompense (tous les champs sont ' +
        "optionnels). N'affecte pas le statut actif/inactif — voir la route " +
        'dédiée `DELETE /rewards/:id`.',
    }),
    ApiBody({ type: UpdateRewardDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Récompense mise à jour avec succès',
      schema: {
        example: {
          success: true,
          reward: { ...REWARD_ADMIN_EXAMPLE, pointsCost: 200 },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Données invalides',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Récompense introuvable',
    }),
  );

export const ApiDeactivateReward = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Désactiver une récompense (Admin)',
      description:
        'Désactive une récompense sans la supprimer (`isActive: false`). ' +
        'Elle disparaît du catalogue public mais les coupons déjà échangés ' +
        'restent valides.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Récompense désactivée avec succès',
      schema: {
        example: {
          success: true,
          reward: {
            id: 'uuid-reward',
            title: 'Ticket de bus gratuit',
            isActive: false,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Cette récompense est déjà désactivée',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Récompense introuvable',
    }),
  );

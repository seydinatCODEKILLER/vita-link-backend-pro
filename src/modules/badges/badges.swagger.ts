import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';

const BADGE_EXAMPLE = {
  id: 'uuid-badge',
  name: 'Guerrier',
  description: 'A effectué 5 dons de sang',
  iconUrl: 'https://res.cloudinary.com/vita-link/badges/guerrier.png',
  criteria: '{"minDonations": 5}',
  isSeasonal: false,
  season: null,
  isActive: true,
  createdAt: '2026-06-25T10:00:00.000Z',
};

export const ApiListBadges = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Lister tous les badges (Admin)',
      description:
        'Retourne tous les badges existants, actifs comme désactivés, avec ' +
        'leurs critères bruts (JSON encodé en string). Réservé aux admins.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des badges récupérée avec succès',
      schema: { example: { success: true, badges: [BADGE_EXAMPLE] } },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
  );

export const ApiCreateBadge = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Créer un nouveau badge',
      description:
        'Crée un badge actif par défaut. Le champ `criteria` doit être un ' +
        'objet JSON valide, encodé en string, décrivant les conditions ' +
        "d'obtention. Clés reconnues par le moteur d'attribution : " +
        '`minDonations`, `exactDonations`, `minPoints`, `bloodType`.\n\n' +
        'Notifie tous les donneurs en temps réel (`badges:new`) une fois créé.',
    }),
    ApiBody({ type: CreateBadgeDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Badge créé avec succès',
      schema: { example: { success: true, badge: BADGE_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        "Données invalides (ex: `criteria` n'est pas un JSON valide)",
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
  );

export const ApiUpdateBadge = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Modifier un badge existant',
      description:
        'Met à jour partiellement un badge (tous les champs sont optionnels). ' +
        "N'affecte pas le statut actif/inactif — voir les routes dédiées " +
        '`DELETE /badges/:id` et `PATCH /badges/:id/reactivate`. ' +
        'Notifie les donneurs en temps réel (`badges:updated`).',
    }),
    ApiBody({ type: UpdateBadgeDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Badge mis à jour avec succès',
      schema: {
        example: {
          success: true,
          badge: { ...BADGE_EXAMPLE, name: 'Vétéran' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        "Données invalides (ex: `criteria` n'est pas un JSON valide)",
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Badge introuvable',
    }),
  );

export const ApiDeactivateBadge = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Désactiver un badge (soft delete)',
      description:
        'Désactive un badge sans le supprimer (`isActive: false`). Un badge ' +
        "désactivé n'est plus attribuable aux donneurs, mais ceux qui " +
        "l'ont déjà obtenu le conservent. Notifie les donneurs " +
        '(`badges:deactivated`).',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Badge désactivé avec succès',
      schema: {
        example: {
          success: true,
          badge: { id: 'uuid-badge', name: 'Guerrier', isActive: false },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Ce badge est déjà désactivé',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Badge introuvable',
    }),
  );

export const ApiReactivateBadge = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Réactiver un badge désactivé',
      description:
        'Réactive un badge précédemment désactivé (`isActive: true`), le ' +
        "rendant à nouveau attribuable. Notifie les donneurs comme s'il " +
        "venait d'être créé (`badges:new`).",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Badge réactivé avec succès',
      schema: {
        example: {
          success: true,
          badge: { id: 'uuid-badge', name: 'Guerrier', isActive: true },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Ce badge est déjà actif',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Badge introuvable',
    }),
  );

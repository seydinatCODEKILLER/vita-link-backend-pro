import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

const PARTNER_PUBLIC_EXAMPLE = {
  id: 'uuid-partner',
  name: 'Orange Sonatel',
  description: 'Leader des télécoms au Sénégal',
  logoUrl: 'https://res.cloudinary.com/vita-link/partners/orange-sonatel.png',
  websiteUrl: 'https://orange.sn',
};

const PARTNER_ADMIN_EXAMPLE = {
  ...PARTNER_PUBLIC_EXAMPLE,
  isActive: true,
  managedBy: { id: 'uuid-admin', firstName: 'Fatou', lastName: 'Ndiaye' },
  createdAt: '2026-06-25T10:00:00.000Z',
  updatedAt: '2026-06-25T10:00:00.000Z',
};

const partnerMultipartSchema = (required: string[]) => ({
  type: 'object' as const,
  properties: {
    name: { type: 'string', example: 'Orange Sonatel' },
    description: { type: 'string', example: 'Leader des télécoms au Sénégal' },
    websiteUrl: { type: 'string', example: 'https://orange.sn' },
    logo: {
      type: 'string',
      format: 'binary',
      description: 'Image JPEG, PNG ou WEBP — 5 Mo maximum',
    },
  },
  required,
});

export const ApiListPartners = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste des partenaires',
      description:
        'Retourne la liste des partenaires. Les admins voient tous les ' +
        'partenaires (actifs et désactivés), les autres utilisateurs ne ' +
        'voient que les partenaires actifs.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des partenaires récupérée avec succès',
      schema: {
        example: { success: true, partners: [PARTNER_PUBLIC_EXAMPLE] },
      },
    }),
  );

export const ApiGetPartnerById = () =>
  applyDecorators(
    ApiOperation({
      summary: "Détail d'un partenaire",
      description:
        "Retourne les détails d'un partenaire. Un partenaire désactivé " +
        "n'est visible que par les admins (404 pour les autres rôles).",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Partenaire trouvé',
      schema: { example: { success: true, partner: PARTNER_ADMIN_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Partenaire introuvable (ou désactivé pour un non-admin)',
    }),
  );

export const ApiCreatePartner = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Ajouter un nouveau partenaire (Admin)',
      description:
        'Crée un partenaire actif par défaut. Le logo (`logo`, champ fichier) ' +
        'est optionnel et uploadé sur Cloudinary. Si la création échoue après ' +
        'un upload réussi, le logo uploadé est automatiquement supprimé ' +
        '(rollback).',
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({ schema: partnerMultipartSchema(['name']) }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Partenaire créé avec succès',
      schema: { example: { success: true, partner: PARTNER_ADMIN_EXAMPLE } },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "Données invalides ou échec de l'upload du logo",
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Un partenaire avec ce nom existe déjà',
    }),
    ApiResponse({
      status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      description: 'Format de fichier non supporté (JPEG, PNG, WEBP attendus)',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
  );

export const ApiUpdatePartner = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Modifier un partenaire (Admin)',
      description:
        'Met à jour partiellement un partenaire (tous les champs sont ' +
        'optionnels). Un nouveau logo remplace et supprime automatiquement ' +
        "l'ancien sur Cloudinary une fois la mise à jour confirmée en base.",
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({ schema: partnerMultipartSchema([]) }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Partenaire mis à jour avec succès',
      schema: {
        example: {
          success: true,
          partner: { ...PARTNER_ADMIN_EXAMPLE, name: 'Orange Sénégal' },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: "Données invalides ou échec de l'upload du logo",
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Un partenaire avec ce nouveau nom existe déjà',
    }),
    ApiResponse({
      status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      description: 'Format de fichier non supporté (JPEG, PNG, WEBP attendus)',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Partenaire introuvable',
    }),
  );

export const ApiDeactivatePartner = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Désactiver un partenaire (Admin)',
      description:
        'Désactive un partenaire sans le supprimer (`isActive: false`). ' +
        'Les récompenses déjà liées à ce partenaire ne sont pas affectées, ' +
        "mais le partenaire n'apparaît plus dans la liste publique.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Partenaire désactivé avec succès',
      schema: {
        example: {
          success: true,
          partner: {
            id: 'uuid-partner',
            name: 'Orange Sonatel',
            isActive: false,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Ce partenaire est déjà désactivé',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux admins',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Partenaire introuvable',
    }),
  );

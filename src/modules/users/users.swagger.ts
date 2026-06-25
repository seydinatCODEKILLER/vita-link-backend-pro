import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateExpoTokenDto } from './dto/update-expo-token.dto';

export const ApiGetMe = () =>
  applyDecorators(
    ApiOperation({
      summary: "Profil complet de l'utilisateur connecté",
      description:
        'Retourne toutes les informations du profil incluant le profil Jambaar pour les donneurs.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profil récupéré avec succès',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid',
            firstName: 'Aliou',
            lastName: 'Diallo',
            email: 'aliou@gmail.com',
            phone: '+221771234567',
            role: 'DONOR',
            bloodType: 'O_NEG',
            gender: 'MALE',
            avatarUrl: 'https://res.cloudinary.com/...',
            isAvailable: true,
            latitude: 14.6937,
            longitude: -17.4441,
            jambaarsProfile: {
              totalPoints: 150,
              currentGrade: 'SENTINELLE',
              donationCount: 3,
              livesSavedEstimate: 9,
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Utilisateur introuvable',
    }),
  );

export const ApiGetActiveEngagement = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Engagement actif du donneur (QR Code en cours)',
      description:
        'Retourne la réponse à une alerte en cours avec le QR Code si le donneur est en route. ' +
        'Réservé aux donneurs — retourne null si aucun engagement actif.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Engagement actif ou null',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid-response',
            alertId: 'uuid-alert',
            status: 'CONFIRMED',
            qrCode: 'data:image/png;base64,...',
            etaMinutes: 15,
            alert: {
              bloodType: 'O_NEG',
              urgencyLevel: 'VITAL',
              healthStructure: { name: 'Hôpital Principal de Dakar' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
  );

export const ApiUpdateProfile = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mise à jour du profil',
      description:
        'Met à jour les informations personnelles (nom, email, groupe sanguin, date de naissance).',
    }),
    ApiBody({ type: UpdateProfileDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profil mis à jour avec succès',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid',
            firstName: 'Aliou',
            lastName: 'Diallo',
            bloodType: 'A_POS',
            dateOfBirth: '1995-06-15T00:00:00.000Z',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Email déjà utilisé par un autre compte',
    }),
  );

export const ApiUpdateAvatar = () =>
  applyDecorators(
    ApiOperation({
      summary: "Upload de l'avatar",
      description:
        "Upload une image (JPEG, PNG, WEBP — max 5 Mo) sur Cloudinary et met à jour l'URL de l'avatar. " +
        "L'ancien avatar est automatiquement supprimé de Cloudinary.",
    }),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['avatar'],
        properties: {
          avatar: {
            type: 'string',
            format: 'binary',
            description: 'Fichier image (JPEG, PNG ou WEBP — max 5 Mo)',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Avatar mis à jour avec succès',
      schema: {
        example: {
          success: true,
          data: {
            avatarUrl:
              'https://res.cloudinary.com/vita-link/image/upload/avatar_1234567890.jpg',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Format non supporté ou fichier manquant',
    }),
  );

export const ApiUpdateLocation = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mise à jour de la localisation',
      description:
        'Met à jour les coordonnées GPS du donneur. ' +
        'Utilisé pour le matching géospatial lors des alertes de don de sang.',
    }),
    ApiBody({ type: UpdateLocationDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Localisation mise à jour',
      schema: {
        example: {
          success: true,
          data: { latitude: 14.6937, longitude: -17.4441 },
        },
      },
    }),
  );

export const ApiUpdateAvailability = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Toggle disponibilité du donneur',
      description:
        'Permet au donneur de se déclarer disponible ou indisponible pour les alertes. ' +
        "Un donneur indisponible ne recevra pas de notifications d'alerte.",
    }),
    ApiBody({ type: UpdateAvailabilityDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Disponibilité mise à jour',
      schema: {
        example: {
          success: true,
          data: { isAvailable: false },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
  );

export const ApiUpdateExpoToken = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mise à jour du token Expo Push',
      description:
        'Enregistre ou met à jour le token de notification push Expo. ' +
        "Appelé automatiquement par l'application mobile au démarrage.",
    }),
    ApiBody({ type: UpdateExpoTokenDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Token Expo mis à jour',
      schema: {
        example: {
          success: true,
          message: 'Token Expo mis à jour.',
        },
      },
    }),
  );

export const ApiDeleteMe = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Suppression (anonymisation) du compte',
      description:
        "Anonymise les données personnelles de l'utilisateur (RGPD). " +
        "Les données de don sont conservées à des fins statistiques mais dissociées de l'identité. " +
        '**Cette action est irréversible.**',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Compte anonymisé avec succès',
      schema: {
        example: {
          success: true,
          message: 'Votre compte a été supprimé avec succès.',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description:
        'Les agents de santé ne peuvent pas supprimer leur compte via cette route',
    }),
  );

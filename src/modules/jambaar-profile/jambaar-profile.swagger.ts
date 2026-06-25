import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

export const ApiGetMyProfile = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mon profil Jambaar complet',
      description:
        'Retourne le profil gamifié du donneur connecté :\n\n' +
        '- Points, grade actuel, nombre de dons, vies sauvées estimées\n' +
        '- **Progression** vers le grade suivant (% et points restants)\n' +
        '- **Rang** dans le classement global et dans la ville du donneur\n' +
        "- Prochaine date d'éligibilité au don\n\n" +
        'Réservé aux donneurs.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profil Jambaar retourné',
      schema: {
        example: {
          success: true,
          profile: {
            id: 'uuid-profile',
            totalPoints: 620,
            currentGrade: 'SENTINELLE',
            donationCount: 3,
            livesSavedEstimate: 9,
            noShowCount: 0,
            lastDonationAt: '2026-05-10T09:00:00.000Z',
            nextEligibilityAt: '2026-08-08T09:00:00.000Z',
            city: 'Dakar',
            district: 'Plateau',
            createdAt: '2026-01-15T08:00:00.000Z',
            user: {
              id: 'uuid-donor',
              firstName: 'Awa',
              lastName: 'Diop',
              avatarUrl: null,
              bloodType: 'O_NEG',
            },
          },
          progression: {
            currentGrade: 'SENTINELLE',
            nextGrade: 'AMBASSADEUR',
            pointsToNext: 380,
            progressPercent: 62,
          },
          ranks: { global: 14, city: 3 },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Profil Jambaar introuvable',
    }),
  );

export const ApiGetMyBadges = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Mes badges débloqués',
      description:
        'Retourne tous les badges existants avec leur statut pour le donneur :\n\n' +
        "- **Débloqué** : date d'obtention incluse\n" +
        "- **Verrouillé** : critère d'obtention visible pour motiver\n\n" +
        'Exemples de badges :\n' +
        '- 🩸 *Premier Pas* — Premier don effectué\n' +
        '- ⚔️ *Guerrier* — 5 dons effectués\n' +
        '- 🦁 *Sang Précieux* — Donneur O- ou AB-\n' +
        '- ⚡ *Réactif* — Arrivée en moins de 30 minutes',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Badges retournés',
      schema: {
        example: {
          success: true,
          earned: 3,
          total: 8,
          badges: [
            {
              id: 'uuid-badge',
              name: 'Premier Pas',
              description: 'Premier don effectué',
              iconUrl: 'https://cdn.example.com/badges/premier-pas.png',
              criteria: '{"minDonations":1}',
              isSeasonal: false,
              season: null,
              isUnlocked: true,
              earnedAt: '2026-02-01T10:00:00.000Z',
            },
            {
              id: 'uuid-badge-2',
              name: 'Guerrier',
              description: '5 dons effectués',
              iconUrl: 'https://cdn.example.com/badges/guerrier.png',
              criteria: '{"minDonations":5}',
              isSeasonal: false,
              season: null,
              isUnlocked: false,
              earnedAt: null,
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Réservé aux donneurs',
    }),
  );

export const ApiGetLeaderboard = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Classement Jambaar (global, par ville ou par quartier)',
      description:
        'Retourne le classement des donneurs par points, avec départage au nombre de dons.\n' +
        'Seuls les donneurs ayant effectué au moins **1 don** apparaissent dans le classement.\n\n' +
        '**Scopes disponibles :**\n' +
        '- Sans filtre → Classement **global**\n' +
        '- `?city=Dakar` → Classement **ville de Dakar**\n' +
        '- `?district=Plateau` → Classement **quartier Plateau**\n' +
        '- `?city=Dakar&district=Plateau` → Classement **quartier Plateau** (district prioritaire)\n\n' +
        'Inclut aussi le **rang du donneur connecté** dans ce classement. ' +
        'Accessible à tout utilisateur authentifié (pas réservé aux donneurs).',
    }),
    ApiQuery({
      name: 'city',
      required: false,
      type: String,
      example: 'Dakar',
      description: 'Filtrer par ville (ex: Dakar, Thiès, Saint-Louis)',
    }),
    ApiQuery({
      name: 'district',
      required: false,
      type: String,
      example: 'Plateau',
      description: 'Filtrer par quartier (ex: Plateau, Médina, HLM)',
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
      example: 20,
      description: 'Nombre de résultats par page (max 100)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Classement retourné',
      schema: {
        example: {
          success: true,
          scope: 'Ville de Dakar',
          leaderboard: [
            {
              rank: 1,
              totalPoints: 1200,
              currentGrade: 'AMBASSADEUR',
              donationCount: 8,
              livesSavedEstimate: 24,
              city: 'Dakar',
              district: 'Plateau',
              user: {
                id: 'uuid-donor',
                firstName: 'Awa',
                lastName: 'Diop',
                avatarUrl: null,
                bloodType: 'O_NEG',
              },
            },
          ],
          myRank: 3,
          pagination: { total: 42, page: 1, limit: 20, totalPages: 3 },
        },
      },
    }),
  );

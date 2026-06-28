import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { SuspendStructureDto } from './dto/suspend-structure.dto';

export const ApiGetDashboard = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Tableau de bord national (KPIs)',
      description:
        'Récupère les indicateurs clés de performance de Vita-Link à ' +
        "l'échelle nationale. Données calculées en temps réel.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'KPIs calculés',
      schema: {
        example: {
          success: true,
          kpis: {
            totalDonors: 4500,
            totalStructures: 32,
            totalDonations: 1200,
            totalAlerts: 890,
            avgResponseTimeMinutes: 14.5,
            criticalStocksCount: 2,
            livesSavedEstimate: 1800,
            pendingStructures: 5,
          },
        },
      },
    }),
  );

export const ApiGetMonthlyStats = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Statistiques mensuelles (Tendances)',
      description:
        "Récupère le nombre de dons, d'alertes et l'estimation des vies " +
        'sauvées par mois pour une année donnée.',
    }),
    ApiQuery({ name: 'year', required: false, type: Number, example: 2026 }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Données mensuelles',
      schema: {
        example: {
          success: true,
          data: [
            { month: 'Jan', donations: 120, alerts: 80, livesSaved: 360 },
            { month: 'Fév', donations: 95, alerts: 60, livesSaved: 285 },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Année invalide (doit être entre 2020 et l’année courante)',
    }),
  );

export const ApiGetRegionStats = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Données heatmap par région',
      description:
        'Récupère le nombre de donneurs actifs et le niveau de demande ' +
        '(alertes) par ville/région géographique. Le demandLevel est ' +
        'normalisé de 0 à 100.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Données régionales',
      schema: {
        example: {
          success: true,
          data: [{ region: 'Dakar', demandLevel: 80, donorsCount: 45 }],
        },
      },
    }),
  );

export const ApiGetUsers = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Annuaire des utilisateurs (Filtrage & Pagination)',
      description:
        'Recherche avancée des utilisateurs par rôle, groupe sanguin, ville, ' +
        "et statut d'activation.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste paginée',
      schema: {
        example: {
          success: true,
          total: 4500,
          users: [
            {
              id: 'uuid-user',
              firstName: 'Awa',
              lastName: 'Diop',
              email: 'awa.diop@example.com',
              role: 'DONOR',
              isActive: true,
              jambaarsProfile: {
                totalPoints: 620,
                currentGrade: 'SENTINELLE',
                donationCount: 3,
                noShowCount: 0,
                city: 'Dakar',
              },
            },
          ],
        },
      },
    }),
  );

export const ApiGetUserById = () =>
  applyDecorators(
    ApiOperation({ summary: "Détail complet d'un utilisateur" }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Profil utilisateur avec statistiques',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Utilisateur introuvable',
    }),
  );

export const ApiSuspendUser = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Suspendre un utilisateur',
      description:
        "Désactive le compte, révoque ses tokens et crée un log d'audit. " +
        'Utile contre les faux donneurs (No-shows) ou faux hôpitaux.',
    }),
    ApiBody({ type: SuspendUserDto }),
    ApiResponse({ status: HttpStatus.OK, description: 'Utilisateur suspendu' }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Utilisateur déjà suspendu',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Utilisateur introuvable',
    }),
  );

export const ApiReactivateUser = () =>
  applyDecorators(
    ApiOperation({ summary: 'Réactiver un utilisateur suspendu' }),
    ApiResponse({ status: HttpStatus.OK, description: 'Utilisateur réactivé' }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Utilisateur déjà actif',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Utilisateur introuvable',
    }),
  );

export const ApiGetStructures = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste des structures (avec filtres)',
      description:
        'Permet de filtrer les structures par statut, type ou par région ' +
        'administrative.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des structures',
      schema: {
        example: {
          success: true,
          total: 32,
          structures: [
            {
              id: 'uuid-structure',
              name: 'CNTS de Dakar',
              structureType: 'CNTS',
              status: 'VERIFIED',
              region: 'Dakar',
              affiliatedCntsId: null,
              _count: { staffMembers: 8, alerts: 120, donations: 450 },
            },
          ],
        },
      },
    }),
  );

export const ApiVerifyStructure = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Valider une structure de santé',
      description:
        'Passe le statut de la structure à VERIFIED.\n\n' +
        "- Si c'est un **Hôpital**, il doit OBLIGATOIREMENT avoir une CNTS " +
        "d'affiliation pour être vérifié.\n" +
        "- Si c'est une **CNTS**, son stock sanguin est automatiquement " +
        'initialisé à 0 (pour les 8 groupes sanguins) lors de la vérification.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Structure validée avec succès',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Hôpital non affilié à une CNTS — vérification impossible',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Structure introuvable',
    }),
  );

export const ApiSuspendStructure = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Suspendre une structure de santé',
      description:
        "Bloque l'accès à la structure et à tous ses agents. Action tracée " +
        "dans les logs d'audit.",
    }),
    ApiBody({ type: SuspendStructureDto }),
    ApiResponse({ status: HttpStatus.OK, description: 'Structure suspendue' }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Structure introuvable',
    }),
  );

export const ApiGetAuditLogs = () =>
  applyDecorators(
    ApiOperation({
      summary: "Journal des actions (Logs d'audit)",
      description:
        'Historique complet des actions sensibles (suspensions, ' +
        'validations, alertes créées). Permet de traquer les abus.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Logs récupérés',
      schema: {
        example: {
          success: true,
          total: 230,
          logs: [
            {
              id: 'uuid-log',
              action: 'USER_SUSPENDED',
              entityType: 'USER',
              entityId: 'uuid-user',
              details: '{"reason":"Trop de No-shows"}',
              createdAt: '2026-06-25T10:00:00.000Z',
              user: {
                id: 'uuid-admin',
                firstName: 'Fatou',
                lastName: 'Ndiaye',
              },
            },
          ],
        },
      },
    }),
  );

export const ApiGetRecentAlerts = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Alertes les plus récentes',
      description:
        'Récupère les dernières alertes créées sur la plateforme avec le ' +
        'nom de la structure et la région.',
    }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 10 }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des alertes récentes',
      schema: {
        example: {
          success: true,
          alerts: [
            {
              id: 'uuid-alert',
              structureName: 'Hôpital Principal',
              region: 'Dakar',
              bloodGroup: 'ONEG',
              status: 'ACTIVE',
              createdAt: '2026-06-25T10:00:00.000Z',
            },
          ],
        },
      },
    }),
  );

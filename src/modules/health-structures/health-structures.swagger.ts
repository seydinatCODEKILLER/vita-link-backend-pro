import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UpdateStructureDto } from './dto/update-structure.dto';
import { AddStaffDto } from './dto/add-staff.dto';

export const ApiGetAvailableCnts = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste des CNTS disponibles pour affiliation',
      description:
        "Retourne la liste des CNTS vérifiées et actives. Utilisé lors de la pré-inscription d'un hôpital.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des CNTS disponibles',
      schema: {
        example: {
          success: true,
          data: [
            {
              id: 'uuid-cnts',
              name: 'CNTS de Dakar',
              region: 'Dakar',
              address: 'Avenue Blaise Diagne',
            },
          ],
        },
      },
    }),
  );

export const ApiGetAllStructures = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste toutes les structures (Admin)',
      description:
        "Récupère la liste complète des structures avec le nombre d'agents, d'alertes et de dons associés.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste récupérée',
      schema: {
        example: {
          success: true,
          data: [
            {
              id: 'uuid',
              name: 'CNTS de Dakar',
              status: 'VERIFIED',
              _count: { staffMembers: 5, alerts: 12, donations: 45 },
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Accès refusé — rôle ADMIN requis',
    }),
  );

export const ApiGetMyStructure = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Ma structure de santé',
      description:
        "Retourne les informations détaillées de la structure à laquelle l'agent connecté est rattaché.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Structure trouvée',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid-structure',
            name: 'Hôpital Principal de Dakar',
            structureType: 'HOSPITAL',
            status: 'VERIFIED',
            region: 'Dakar',
            address: 'Avenue Nelson Mandela, Dakar',
            latitude: 14.6937,
            longitude: -17.4441,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Agent non rattaché à une structure',
    }),
  );

export const ApiUpdateMyStructure = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Modifier les infos de ma structure',
      description:
        'Réservé au directeur (`isStructureAdmin = true`). ' +
        "Permet de mettre à jour le nom, l'adresse, la localisation ou l'affiliation CNTS.",
    }),
    ApiBody({ type: UpdateStructureDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Structure mise à jour',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid-structure',
            name: 'Nouveau Nom Hôpital',
            address: 'Rue Y, Dakar',
            latitude: 14.6937,
            longitude: -17.4441,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Action réservée au directeur de la structure',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Une CNTS ne peut pas être affiliée à une autre structure',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Structure introuvable',
    }),
  );

export const ApiGetStaff = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Liste des agents de ma structure',
      description:
        'Récupère tous les utilisateurs (directeur et agents) rattachés à la structure.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste du personnel',
      schema: {
        example: {
          success: true,
          data: [
            {
              id: 'uuid-agent',
              firstName: 'Mamadou',
              lastName: 'Diop',
              email: 'm.diop@hpd.sn',
              phone: '+221771234567',
              role: 'HOSPITAL_AGENT',
              isStructureAdmin: false,
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Seul le directeur peut consulter la liste des agents',
    }),
  );

export const ApiAddStaff = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Ajouter un nouvel agent',
      description:
        "Le directeur crée le compte d'un agent et le rattache automatiquement à sa structure. " +
        'Le rôle est attribué automatiquement selon le type de structure (CNTS_AGENT ou HOSPITAL_AGENT).',
    }),
    ApiBody({ type: AddStaffDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Agent créé avec succès',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid-agent',
            firstName: 'Mamadou',
            lastName: 'Diop',
            email: 'm.diop@hpd.sn',
            role: 'HOSPITAL_AGENT',
            isStructureAdmin: false,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Seul le directeur peut ajouter des agents',
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Email ou téléphone déjà utilisé',
    }),
  );

export const ApiRemoveStaff = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Retirer un agent de la structure',
      description:
        "Détache l'agent de la structure (son compte n'est pas supprimé). " +
        'Le directeur ne peut pas se retirer lui-même.',
    }),
    ApiParam({
      name: 'userId',
      type: String,
      format: 'uuid',
      description: "UUID de l'agent à retirer",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Agent retiré avec succès',
      schema: {
        example: { success: true, message: 'Agent retiré avec succès' },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Tentative de se retirer soi-même',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Seul le directeur peut retirer des agents',
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: "Agent introuvable ou n'appartient pas à cette structure",
    }),
  );

export const ApiGetAffiliatedHospitals = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Hôpitaux affiliés à ma CNTS',
      description:
        'Réservé aux agents CNTS. Retourne la liste des hôpitaux et centres de santé rattachés à cette CNTS.',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['PENDING_REVIEW', 'VERIFIED', 'SUSPENDED'],
      description: 'Filtrer par statut de la structure',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Liste des hôpitaux affiliés',
      schema: {
        example: {
          success: true,
          data: [
            {
              id: 'uuid',
              name: 'Hôpital Principal de Dakar',
              structureType: 'HOSPITAL',
              status: 'VERIFIED',
              region: 'Dakar',
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Seule une CNTS peut consulter ses hôpitaux affiliés',
    }),
  );

export const ApiGetStats = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Statistiques de ma structure',
      description:
        'Tableau de bord médical : temps de réponse moyen des Jambaars, ' +
        'nombre de dons validés, état des stocks de sang.',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Statistiques calculées',
      schema: {
        example: {
          success: true,
          data: {
            totalDonations: 45,
            avgResponseTimeMinutes: 12,
            alerts: { ACTIVE: 2, QUOTA_REACHED: 15 },
            bloodStocks: [
              { bloodType: 'O_NEG', quantity: 5, level: 'ADEQUATE' },
              { bloodType: 'A_POS', quantity: 1, level: 'CRITICAL' },
            ],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Non rattaché à une structure',
    }),
  );

export const ApiGetStructureById = () =>
  applyDecorators(
    ApiOperation({
      summary: "Détail d'une structure par ID",
      description:
        "Accès aux détails d'une structure spécifique (Admin et agents de santé).",
    }),
    ApiParam({
      name: 'id',
      type: String,
      format: 'uuid',
      description: 'UUID de la structure',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Détails de la structure',
      schema: {
        example: {
          success: true,
          data: {
            id: 'uuid',
            name: 'CNTS de Dakar',
            structureType: 'CNTS',
            status: 'VERIFIED',
            region: 'Dakar',
            staffMembers: [],
            bloodStocks: [],
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Structure introuvable',
    }),
  );

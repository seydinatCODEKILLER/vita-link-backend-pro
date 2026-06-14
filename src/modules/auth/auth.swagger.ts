import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { RegisterCntsDto } from './dto/register-cnts.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export const ApiRegisterDonor = () =>
  applyDecorators(
    ApiOperation({
      summary: "Pré-inscription d'un donneur (Jambaar)",
      description:
        "Vérifie la disponibilité du téléphone et de l'email, puis envoie un OTP. " +
        "**Le compte n'est pas encore créé** — il le sera lors de la vérification OTP.",
    }),
    ApiBody({ type: RegisterDonorDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Disponibilité vérifiée et OTP envoyé avec succès',
      schema: {
        example: {
          success: true,
          message: 'Code de vérification envoyé à votre adresse email.',
          email: 'aliou@gmail.com',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Email ou téléphone déjà utilisé',
    }),
  );

export const ApiRegisterCnts = () =>
  applyDecorators(
    ApiOperation({
      summary:
        "Inscription d'un Centre National de Transfusion Sanguine (CNTS)",
      description:
        "Crée le compte d'une CNTS ainsi que le compte de son directeur administratif. " +
        'Le directeur reçoit automatiquement le rôle `CNTS_ADMIN`. ' +
        'Le stock sanguin est initialisé à 0 pour les 8 groupes sanguins. ' +
        'La structure est créée avec le statut `PENDING_REVIEW` en attente de validation.',
    }),
    ApiBody({ type: RegisterCntsDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description:
        'CNTS et son directeur créés avec succès (en attente de vérification)',
      schema: {
        example: {
          success: true,
          message:
            "CNTS inscrite avec succès. En attente de vérification par l'administration.",
          director: {
            id: 'uuid-director',
            email: 'admin.cnts@transfusion.sn',
            role: 'CNTS_ADMIN',
            isStructureAdmin: true,
          },
          structure: {
            id: 'uuid-structure',
            name: 'CNTS de Dakar',
            structureType: 'CNTS',
            status: 'PENDING_REVIEW',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: "Email, téléphone ou numéro d'enregistrement déjà utilisé",
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Erreur de validation des données',
    }),
  );

export const ApiRegisterHospital = () =>
  applyDecorators(
    ApiOperation({
      summary: "Inscription d'un Hôpital ou Centre de Santé",
      description:
        "Crée le compte d'un établissement de soins et de son directeur. " +
        "Le directeur reçoit le rôle `HOSPITAL_AGENT` avec les droits d'administration. " +
        "**Règle métier** : L'établissement DOIT être affilié à une CNTS existante (`affiliatedCntsId`).",
    }),
    ApiBody({ type: RegisterHospitalDto }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Établissement et son directeur créés avec succès',
      schema: {
        example: {
          success: true,
          message: 'Hôpital inscrit avec succès. En attente de vérification.',
          director: {
            id: 'uuid-director',
            email: 'dr.sow@hpd.sn',
            role: 'HOSPITAL_AGENT',
            isStructureAdmin: true,
          },
          structure: {
            id: 'uuid-structure',
            name: 'Hôpital Principal de Dakar',
            structureType: 'HOSPITAL',
            status: 'PENDING_REVIEW',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: "CNTS d'affiliation introuvable",
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Email, téléphone ou numéro déjà utilisé',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Erreur de validation',
    }),
  );

export const ApiSendOtp = () =>
  applyDecorators(
    ApiOperation({
      summary: "Envoi / renvoi d'un OTP par email",
      description:
        'Invalide les OTPs précédents et envoie un nouveau code valable 10 minutes.',
    }),
    ApiBody({ type: SendOtpDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'OTP envoyé avec succès',
      schema: {
        example: { success: true, message: 'Code de vérification renvoyé.' },
      },
    }),
  );

export const ApiVerifyOtp = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Vérification OTP → Création compte donneur → JWT',
      description:
        'Vérifie le code OTP. Si valide : crée le compte donneur, ' +
        'crée automatiquement le profil Jambaar (0 pts, grade ASPIRANT), ' +
        'et retourne un access token (15 min) + refresh token (30 jours).',
    }),
    ApiBody({ type: VerifyOtpDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Authentification réussie et compte Jambaar créé',
      schema: {
        example: {
          success: true,
          message:
            'Vérification réussie. Bienvenue dans la communauté Jambaar !',
          accessToken: 'eyJhbGciOiJI...',
          refreshToken: 'eyJhbGciOiJI...',
          user: {
            id: 'uuid',
            email: 'aliou@gmail.com',
            role: 'DONOR',
            bloodType: 'O_NEG',
            jambaarsProfile: {
              totalPoints: 0,
              currentGrade: 'ASPIRANT',
              donationCount: 0,
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'OTP invalide, expiré ou incorrect',
    }),
  );

export const ApiLogin = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Connexion agents de santé et admins (email + mot de passe)',
      description:
        'Réservé aux rôles `CNTS_AGENT`, `CNTS_ADMIN`, `HOSPITAL_AGENT` et `ADMIN`. ' +
        "Les donneurs utilisent le flux OTP. Implémente une protection **timing-safe** contre l'énumération d'emails.",
    }),
    ApiBody({ type: LoginDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Connexion réussie',
      schema: {
        example: {
          success: true,
          accessToken: 'eyJhbGciOiJI...',
          refreshToken: 'eyJhbGciOiJI...',
          user: {
            id: 'uuid',
            email: 'dr.sow@hpd.sn',
            role: 'HOSPITAL_AGENT',
            isStructureAdmin: true,
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Identifiants invalides',
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Compte suspendu ou rôle non autorisé',
    }),
  );

export const ApiRefreshToken = () =>
  applyDecorators(
    ApiOperation({
      summary: "Renouvellement de l'access token",
      description:
        'Échange un refresh token valide contre un nouveau pair de tokens. ' +
        "Token rotation : l'ancien refresh token est révoqué immédiatement.",
    }),
    ApiBody({ type: RefreshTokenDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Nouveaux tokens générés avec succès',
      schema: {
        example: {
          success: true,
          accessToken: 'eyJhbGciOiJI_NEW...',
          refreshToken: 'eyJhbGciOiJI_NEW...',
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Refresh token invalide, expiré ou révoqué',
    }),
  );

export const ApiLogout = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Déconnexion — révocation du refresh token',
      description:
        'Invalide le refresh token en base de données. ' +
        "L'access token expirera naturellement à sa date d'expiration.",
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Déconnexion réussie',
      schema: { example: { success: true, message: 'Déconnexion réussie.' } },
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Non authentifié',
    }),
  );

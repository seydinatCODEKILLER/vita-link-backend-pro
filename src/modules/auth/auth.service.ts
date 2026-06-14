import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { HealthStructuresRepository } from '@/modules/health-structures/health-structures.repository';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { AuthEmailService } from './email.service';
import { comparePassword, hashPassword } from '@/common/utils/hasher.utils';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { RegisterCntsDto } from './dto/register-cnts.dto';
import { RegisterHospitalDto } from './dto/register-hospital.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@/common/enums/roles.enum';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly healthStructuresRepository: HealthStructuresRepository,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly emailService: AuthEmailService,
    private readonly config: ConfigService,
  ) {}

  // ── Donneur ────────────────────────────────────────────────

  async registerDonor(dto: RegisterDonorDto) {
    if (await this.authRepository.findByPhone(dto.phone)) {
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    }

    if (dto.email && (await this.authRepository.findByEmail(dto.email))) {
      throw new ConflictException('Cette adresse email est déjà utilisée');
    }

    if (!dto.email) {
      return {
        message:
          'Numéro disponible. Fournissez votre email pour recevoir le code de vérification.',
        requiresEmail: true,
        phone: dto.phone,
      };
    }

    const email = dto.email;

    await this.authRepository.createDonor({ ...dto, email });
    const code = await this.otpService.send(email);
    await this.emailService.sendOtp(email, dto.firstName, code);

    this.logger.log(`OTP envoyé — donor_register — ${email}`);

    return {
      message:
        'Compte créé. Code de vérification envoyé à votre adresse email.',
      email,
    };
  }

  async sendOtp({ email }: { email: string }) {
    const user = await this.authRepository.findByEmailWithRole(email);
    if (!user)
      throw new NotFoundException('Aucun compte trouvé pour cet email.');
    if (user.role !== Role.DONOR) {
      throw new ForbiddenException(
        'Les comptes structures de santé utilisent la connexion par mot de passe.',
      );
    }
    if (!user.isActive)
      throw new ForbiddenException('Votre compte a été suspendu.');

    const code = await this.otpService.send(email);
    await this.emailService.sendOtp(email, user.firstName, code);

    this.logger.log(`OTP envoyé — reconnect_donor — ${email}`);

    return { message: 'Code de vérification envoyé à votre adresse email.' };
  }

  async verifyOtp({ email, code }: { email: string; code: string }) {
    await this.otpService.verifyAndConsume(email, code);

    const user = await this.authRepository.findDonorByEmail(email);
    if (!user)
      throw new NotFoundException('Aucun compte trouvé pour cet email.');

    const tokens = await this.tokenService.issueAndStore({
      id: user.id,
      role: user.role as Role,
    });

    this.logger.log(`OTP vérifié — ${user.id}`);

    return {
      message: 'Vérification réussie. Bienvenue dans la communauté Jambaar !',
      ...tokens,
      user,
    };
  }

  // ── Structures de santé ────────────────────────────────────

  async registerCnts(dto: RegisterCntsDto) {
    await this._checkStructureUniqueness(dto);
    const passwordHash = await hashPassword(dto.password);
    const { structure, director } =
      await this.healthStructuresRepository.createCntsWithDirector({
        ...dto,
        passwordHash,
      });

    this.logger.log(`CNTS inscrite — ${structure.id}`);

    return {
      message:
        "CNTS inscrite avec succès. En attente de vérification par l'administration.",
      director,
      structure,
    };
  }

  async registerHospital(dto: RegisterHospitalDto) {
    const cnts = await this.healthStructuresRepository.findValidCntsById(
      dto.affiliatedCntsId,
    );
    if (!cnts) {
      throw new NotFoundException(
        "La CNTS d'affiliation spécifiée est introuvable ou invalide.",
      );
    }

    await this._checkStructureUniqueness(dto);
    const passwordHash = await hashPassword(dto.password);
    const { structure, director } =
      await this.healthStructuresRepository.createHospitalWithDirector({
        ...dto,
        passwordHash,
      });

    this.logger.log(`Hôpital inscrit — ${structure.id}`);

    return {
      message: 'Hôpital inscrit avec succès. En attente de vérification.',
      director,
      structure,
    };
  }

  // ── Auth classique ─────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.authRepository.findByEmail(dto.email);
    const dummyHash = this.config.get<string>('DUMMY_HASH') ?? '';
    const isValid = await comparePassword(
      dto.password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !isValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    if (!user.isActive) {
      throw new ForbiddenException(
        "Compte suspendu. Contactez l'administration.",
      );
    }
    if (user.role === Role.DONOR) {
      throw new ForbiddenException(
        'Les donneurs se connectent via le code OTP.',
      );
    }

    const tokens = await this.tokenService.issueAndStore({
      id: user.id,
      role: user.role as Role,
    });

    this.logger.log(`LOGIN_SUCCESS — ${user.id} — ${user.role}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isStructureAdmin: user.isStructureAdmin,
        healthStructureId: user.healthStructureId,
      },
    };
  }

  async refresh({ refreshToken }: { refreshToken: string }) {
    return this.tokenService.rotate(refreshToken);
  }

  async logout(userId: string) {
    await this.tokenService.revoke(userId);
    this.logger.log(`LOGOUT — ${userId}`);
    return { message: 'Déconnexion réussie.' };
  }

  // ── Helpers privés ─────────────────────────────────────────

  private async _checkStructureUniqueness(dto: {
    email: string;
    phone: string;
    registrationNumber: string;
  }) {
    const [byEmail, byPhone, byReg] = await Promise.all([
      this.authRepository.findByEmail(dto.email),
      this.authRepository.findByPhone(dto.phone),
      this.healthStructuresRepository.findByRegistrationNumber(
        dto.registrationNumber,
      ),
    ]);
    if (byEmail)
      throw new ConflictException('Cette adresse email est déjà utilisée');
    if (byPhone)
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    if (byReg)
      throw new ConflictException(
        "Ce numéro d'enregistrement est déjà utilisé",
      );
  }
}

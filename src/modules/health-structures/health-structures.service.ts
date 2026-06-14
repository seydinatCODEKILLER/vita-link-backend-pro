import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HealthStructuresRepository } from './health-structures.repository';
import { hashPassword } from '@/common/utils/hasher.utils';
import { UpdateStructureDto } from './dto/update-structure.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { HealthStructureStatus, StructureType } from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';

@Injectable()
export class HealthStructuresService {
  private readonly logger = new Logger(HealthStructuresService.name);

  constructor(private readonly repository: HealthStructuresRepository) {}

  // ── Lecture ────────────────────────────────────────────────

  getAll() {
    return this.repository.findAll();
  }

  async getById(id: string) {
    const structure = await this.repository.findStructureById(id);
    if (!structure) {
      throw new NotFoundException('Structure de santé introuvable');
    }
    return structure;
  }

  async getMyStructure(userId: string) {
    const result = await this.repository.findByUserId(userId);
    if (!result?.employerStructure) {
      throw new NotFoundException(
        "Vous n'êtes rattaché à aucune structure de santé",
      );
    }
    return result.employerStructure;
  }

  async getStats(user: AuthenticatedUser) {
    if (!user.healthStructureId) {
      throw new NotFoundException("Vous n'êtes rattaché à aucune structure");
    }
    const structure = await this.repository.findStructureById(
      user.healthStructureId,
    );
    if (!structure) throw new NotFoundException('Structure introuvable');

    return this.repository.getStats(
      user.healthStructureId,
      structure.structureType,
    );
  }

  getStaff(user: AuthenticatedUser) {
    if (!user.isStructureAdmin) {
      throw new ForbiddenException(
        'Seul le directeur peut consulter la liste des agents',
      );
    }
    return this.repository.findStaff(user.healthStructureId!);
  }

  getAffiliatedHospitals(
    user: AuthenticatedUser,
    filters: { status?: HealthStructureStatus },
  ) {
    if (user.employerStructure?.structureType !== StructureType.CNTS) {
      throw new ForbiddenException(
        'Seule une CNTS peut consulter ses hôpitaux affiliés',
      );
    }
    return this.repository.findAffiliatedHospitals(
      user.healthStructureId!,
      filters,
    );
  }

  getAvailableCnts() {
    return this.repository.findAvailableCnts();
  }

  // ── Mutations ──────────────────────────────────────────────

  async updateMyStructure(user: AuthenticatedUser, dto: UpdateStructureDto) {
    if (!user.isStructureAdmin) {
      throw new ForbiddenException(
        'Seul le directeur peut modifier les informations de la structure',
      );
    }

    if (dto.affiliatedCntsId) {
      if (user.employerStructure?.structureType === StructureType.CNTS) {
        throw new BadRequestException(
          'Une CNTS ne peut pas être affiliée à une autre structure',
        );
      }
      const targetCnts = await this.repository.findStructureById(
        dto.affiliatedCntsId,
      );
      if (!targetCnts || targetCnts.structureType !== StructureType.CNTS) {
        throw new BadRequestException(
          "La structure d'affiliation spécifiée n'est pas une CNTS valide",
        );
      }
    }

    const result = await this.repository.findByUserId(user.id);
    if (!result?.healthStructureId) {
      throw new NotFoundException('Structure introuvable');
    }

    const updated = await this.repository.updateStructure(
      result.healthStructureId,
      dto,
    );

    this.logger.log(
      `STRUCTURE_UPDATED — ${result.healthStructureId} — par ${user.id}`,
    );

    return updated;
  }

  async addStaff(user: AuthenticatedUser, dto: AddStaffDto) {
    if (!user.isStructureAdmin) {
      throw new ForbiddenException('Seul le directeur peut ajouter des agents');
    }

    const [emailTaken, phoneTaken] = await Promise.all([
      this.repository.findUserByEmail(dto.email),
      this.repository.findUserByPhone(dto.phone),
    ]);

    if (emailTaken) throw new ConflictException('Cet email est déjà utilisé');
    if (phoneTaken)
      throw new ConflictException('Ce téléphone est déjà utilisé');

    const passwordHash = await hashPassword(dto.password);

    const structureType = user.employerStructure?.structureType;
    const role =
      structureType === StructureType.CNTS
        ? dto.isStructureAdmin
          ? 'CNTS_ADMIN'
          : 'CNTS_AGENT'
        : 'HOSPITAL_AGENT';

    const agent = await this.repository.addStaff({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role,
      isActive: true,
      healthStructureId: user.healthStructureId!,
      isStructureAdmin: dto.isStructureAdmin ?? false,
    });

    this.logger.log(
      `STAFF_ADDED — ${agent.id} — structure ${user.healthStructureId}`,
    );

    return agent;
  }

  async removeStaff(user: AuthenticatedUser, targetUserId: string) {
    if (!user.isStructureAdmin) {
      throw new ForbiddenException('Seul le directeur peut retirer des agents');
    }
    if (targetUserId === user.id) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous retirer vous-même de la structure',
      );
    }

    const staffMember = await this.repository.findStaffMember(
      targetUserId,
      user.healthStructureId!,
    );
    if (!staffMember) {
      throw new NotFoundException(
        "Cet agent n'appartient pas à votre structure",
      );
    }

    await this.repository.removeStaff(targetUserId);

    this.logger.log(
      `STAFF_REMOVED — ${targetUserId} — structure ${user.healthStructureId}`,
    );

    return { message: 'Agent retiré avec succès' };
  }
}

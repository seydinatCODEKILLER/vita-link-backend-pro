import { Injectable, ForbiddenException } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';
import { CntsDashboardDto } from './dto/cnts-dashboard.dto';
import { HospitalDashboardDto } from './dto/hospital-dashboard.dto';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { StructureType } from '@/generated/prisma/enums';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  // ── GET /dashboard/cnts ─────────────────────────────────────
  async getCntsDashboard(user: AuthenticatedUser, dto: CntsDashboardDto) {
    if (user.employerStructure?.structureType !== StructureType.CNTS) {
      throw new ForbiddenException('Accès réservé aux agents de la CNTS');
    }

    const limit = dto.recentRequestsLimit ?? 5;
    return this.repository.getCntsDashboardData(user.healthStructureId!, limit);
  }

  // ── GET /dashboard/hospital ─────────────────────────────────
  async getHospitalDashboard(
    user: AuthenticatedUser,
    dto: HospitalDashboardDto,
  ) {
    const structureType = user.employerStructure?.structureType;
    if (
      structureType !== StructureType.HOSPITAL &&
      structureType !== StructureType.HEALTH_CENTER
    ) {
      throw new ForbiddenException('Accès réservé aux établissements de soins');
    }

    const limit = dto.myRequestsLimit ?? 5;
    const affiliatedCntsId = user.employerStructure?.affiliatedCntsId ?? null;

    return this.repository.getHospitalDashboardData(
      user.healthStructureId!,
      affiliatedCntsId,
      limit,
    );
  }
}

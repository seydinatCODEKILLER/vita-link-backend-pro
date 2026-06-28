import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AdminRepository } from './admin.repository';
import { EventsService } from '@/events/events.service';
import { GetUsersDto } from './dto/get-users.dto';
import { GetStructuresDto } from './dto/get-structures.dto';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { StructureType } from '@/generated/prisma/enums';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly repository: AdminRepository,
    private readonly events: EventsService,
  ) {}

  // ── GET /admin/dashboard ─────────────────────────────────────
  getDashboard() {
    return this.repository.getDashboardKpis();
  }

  // ── GET /admin/stats/monthly ──────────────────────────────────
  getMonthlyStats(year: number | undefined) {
    const currentYear = new Date().getFullYear();
    const targetYear = year ?? currentYear;

    if (targetYear < 2020 || targetYear > currentYear) {
      throw new BadRequestException(
        `Année invalide. L'année doit être comprise entre 2020 et ${currentYear}.`,
      );
    }

    return this.repository.getMonthlyStats(targetYear);
  }

  // ── GET /admin/stats/regions ──────────────────────────────────
  getRegionStats() {
    return this.repository.getRegionStats();
  }

  // ── GET /admin/alerts/recent ──────────────────────────────────
  getRecentAlerts(limit: number) {
    return this.repository.getRecentAlerts(limit);
  }

  // ── GET /admin/users ─────────────────────────────────────────
  getUsers(dto: GetUsersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.repository.findUsers({ ...dto, page, limit });
  }

  // ── GET /admin/users/:id ──────────────────────────────────────
  async getUserById(id: string) {
    const user = await this.repository.findUserById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  // ── PATCH /admin/users/:id/suspend ───────────────────────────
  async suspendUser(
    targetId: string,
    adminId: string,
    reason: string | undefined,
  ) {
    const user = await this.repository.findUserById(targetId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (!user.isActive) {
      throw new BadRequestException('Cet utilisateur est déjà suspendu');
    }

    const updated = await this.repository.suspendUser(
      targetId,
      adminId,
      reason,
    );

    this.logger.log(
      `ADMIN_USER_SUSPENDED — ${targetId} — admin: ${adminId} — raison: ${reason ?? '—'}`,
    );

    return updated;
  }

  // ── PATCH /admin/users/:id/reactivate ────────────────────────
  async reactivateUser(targetId: string, adminId: string) {
    const user = await this.repository.findUserById(targetId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.isActive) {
      throw new BadRequestException('Cet utilisateur est déjà actif');
    }

    const updated = await this.repository.reactivateUser(targetId, adminId);

    this.logger.log(`ADMIN_USER_REACTIVATED — ${targetId} — admin: ${adminId}`);

    return updated;
  }

  // ── GET /admin/health-structures ─────────────────────────────
  getStructures(dto: GetStructuresDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.repository.findStructures({ ...dto, page, limit });
  }

  // ── PATCH /admin/health-structures/:id/verify ─────────────────
  async verifyStructure(id: string, adminId: string) {
    const existing = await this.repository.findStructureById(id);
    if (!existing) throw new NotFoundException('Structure introuvable');

    if (
      existing.structureType === StructureType.HOSPITAL ||
      existing.structureType === StructureType.HEALTH_CENTER
    ) {
      if (!existing.affiliatedCntsId) {
        throw new BadRequestException(
          "Impossible de vérifier cet hôpital : il n'est affilié à aucune CNTS. Veuillez d'abord l'affilier via le tableau de bord ou l'API.",
        );
      }
    }

    const updated = await this.repository.verifyStructure(id, adminId);

    if (existing.structureType === StructureType.CNTS) {
      await this.repository.ensureStockInitialized(id);
    }

    this.events.emitToStructure(id, 'structure:verified', {
      structureId: id,
      status: 'VERIFIED',
      verifiedAt: updated.verifiedAt,
    });

    this.logger.log(
      `STRUCTURE_VERIFIED — ${id} — admin: ${adminId} — type: ${existing.structureType}`,
    );

    return updated;
  }

  // ── PATCH /admin/health-structures/:id/suspend ────────────────
  async suspendStructure(
    id: string,
    adminId: string,
    reason: string | undefined,
  ) {
    const existing = await this.repository.findStructureById(id);
    if (!existing) throw new NotFoundException('Structure introuvable');

    const updated = await this.repository.suspendStructure(id, adminId, reason);

    this.logger.log(
      `STRUCTURE_SUSPENDED — ${id} — admin: ${adminId} — raison: ${reason ?? '—'}`,
    );

    return updated;
  }

  // ── GET /admin/audit-logs ─────────────────────────────────────
  getAuditLogs(dto: GetAuditLogsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    return this.repository.findAuditLogs({ ...dto, page, limit });
  }
}

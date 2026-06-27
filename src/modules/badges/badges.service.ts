import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { BadgesRepository } from './badges.repository';
import { EventsService } from '@/events/events.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly repository: BadgesRepository,
    private readonly events: EventsService,
  ) {}

  listBadges() {
    return this.repository.findAllForAdmin();
  }

  async createBadge(dto: CreateBadgeDto) {
    const badge = await this.repository.createBadge(dto);

    this.logger.log(`BADGE_CREATED — ${badge.id} — ${badge.name}`);
    this.events.emitToDonors('badges:new', {
      badgeId: badge.id,
      name: badge.name,
    });

    return badge;
  }

  async updateBadge(id: string, dto: UpdateBadgeDto) {
    const existing = await this.repository.findBadgeById(id);
    if (!existing) throw new NotFoundException('Badge introuvable');

    const badge = await this.repository.updateBadge(id, dto);

    this.logger.log(`BADGE_UPDATED — ${badge.id}`);
    this.events.emitToDonors('badges:updated', {
      badgeId: badge.id,
      name: badge.name,
    });

    return badge;
  }

  async deactivateBadge(id: string) {
    const existing = await this.repository.findBadgeById(id);
    if (!existing) throw new NotFoundException('Badge introuvable');
    if (!existing.isActive) {
      throw new ConflictException('Ce badge est déjà désactivé');
    }

    const badge = await this.repository.softDelete(id);

    this.logger.log(`BADGE_DEACTIVATED — ${badge.id}`);
    this.events.emitToDonors('badges:deactivated', { badgeId: badge.id });

    return badge;
  }

  async reactivateBadge(id: string) {
    const existing = await this.repository.findBadgeById(id);
    if (!existing) throw new NotFoundException('Badge introuvable');
    if (existing.isActive) {
      throw new ConflictException('Ce badge est déjà actif');
    }

    const badge = await this.repository.reactivate(id);

    this.logger.log(`BADGE_REACTIVATED — ${badge.id}`);
    this.events.emitToDonors('badges:new', {
      badgeId: badge.id,
      name: badge.name,
    });

    return badge;
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { RewardsRepository } from './rewards.repository';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { Role } from '@/generated/prisma/enums';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private readonly repository: RewardsRepository) {}

  listAvailableRewards() {
    return this.repository.findAllAvailable();
  }

  listAllRewards() {
    return this.repository.findAllForAdmin();
  }

  async getRewardById(id: string, userRole: Role) {
    const reward = await this.repository.findRewardById(id);
    if (!reward) throw new NotFoundException('Récompense introuvable');

    if (!reward.isActive && userRole !== Role.ADMIN) {
      throw new NotFoundException('Récompense introuvable');
    }

    return reward;
  }

  async createReward(dto: CreateRewardDto) {
    const reward = await this.repository.createReward({
      ...dto,
      expiresAt: dto.expiresAt ?? null,
    });

    this.logger.log(
      `REWARD_CREATED — ${reward.id} — ${reward.title} — ${reward.pointsCost} pts`,
    );

    return reward;
  }

  async updateReward(id: string, dto: UpdateRewardDto) {
    const existing = await this.repository.findRewardById(id);
    if (!existing) throw new NotFoundException('Récompense introuvable');

    const reward = await this.repository.updateReward(id, dto);

    this.logger.log(`REWARD_UPDATED — ${reward.id}`);
    return reward;
  }

  async deactivateReward(id: string) {
    const existing = await this.repository.findRewardById(id);
    if (!existing) throw new NotFoundException('Récompense introuvable');

    if (!existing.isActive) {
      throw new ConflictException('Cette récompense est déjà désactivée');
    }

    const reward = await this.repository.softDelete(id);

    this.logger.log(`REWARD_DEACTIVATED — ${reward.id}`);
    return reward;
  }
}

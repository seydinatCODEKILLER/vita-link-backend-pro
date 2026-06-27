import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { RewardsRepository } from './rewards.repository';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, RewardsRepository],
  exports: [RewardsService, RewardsRepository],
})
export class RewardsModule {}

import { Module } from '@nestjs/common';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repository';
import { RewardsModule } from '@/modules/rewards/rewards.module';
import { JambaarsModule } from '@/modules/jambaar-profile/jambaar-profile.module';

@Module({
  imports: [RewardsModule, JambaarsModule],
  controllers: [CouponsController],
  providers: [CouponsService, CouponsRepository],
  exports: [CouponsService],
})
export class CouponsModule {}

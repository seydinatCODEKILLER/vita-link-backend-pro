import { Module } from '@nestjs/common';
import { DonationsController } from './donations.controller';
import { DonationsService } from './donations.service';
import { DonationsRepository } from './donations.repository';
import { JambaarsModule } from '@/modules/jambaar-profile/jambaar-profile.module';

@Module({
  imports: [JambaarsModule],
  controllers: [DonationsController],
  providers: [DonationsService, DonationsRepository],
  exports: [DonationsService],
})
export class DonationsModule {}

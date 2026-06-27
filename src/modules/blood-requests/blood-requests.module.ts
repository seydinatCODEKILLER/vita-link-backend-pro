import { Module } from '@nestjs/common';
import { BloodRequestsController } from './blood-requests.controller';
import { BloodRequestsService } from './blood-requests.service';
import { BloodRequestsRepository } from './blood-requests.repository';

@Module({
  controllers: [BloodRequestsController],
  providers: [BloodRequestsService, BloodRequestsRepository],
  exports: [BloodRequestsService, BloodRequestsRepository],
})
export class BloodRequestsModule {}

import { Module } from '@nestjs/common';
import { HealthStructuresController } from './health-structures.controller';
import { HealthStructuresService } from './health-structures.service';
import { HealthStructuresRepository } from './health-structures.repository';

@Module({
  controllers: [HealthStructuresController],
  providers: [HealthStructuresService, HealthStructuresRepository],
  exports: [HealthStructuresService, HealthStructuresRepository],
})
export class HealthStructuresModule {}

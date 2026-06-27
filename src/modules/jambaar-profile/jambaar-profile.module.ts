import { Module } from '@nestjs/common';
import { JambaarsController } from './jambaar-profile.controller';
import { JambaarsService } from './jambaar-profile.service';
import { JambaarsRepository } from './jambaar-profile.repository';

@Module({
  controllers: [JambaarsController],
  providers: [JambaarsService, JambaarsRepository],
  exports: [JambaarsService, JambaarsRepository],
})
export class JambaarsModule {}

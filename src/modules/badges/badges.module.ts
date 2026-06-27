import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';
import { BadgesRepository } from './badges.repository';

@Module({
  controllers: [BadgesController],
  providers: [BadgesService, BadgesRepository],
  exports: [BadgesService],
})
export class BadgesModule {}

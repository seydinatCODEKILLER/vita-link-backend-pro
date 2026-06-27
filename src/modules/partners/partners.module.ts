import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';
import { PartnersRepository } from './partners.repository';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [PartnersController],
  providers: [PartnersService, PartnersRepository],
  exports: [PartnersService],
})
export class PartnersModule {}

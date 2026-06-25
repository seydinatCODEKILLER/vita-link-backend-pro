import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { CloudinaryService } from './cloudinary.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, CloudinaryService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}

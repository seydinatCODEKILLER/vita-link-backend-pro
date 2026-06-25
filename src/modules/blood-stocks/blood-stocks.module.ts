import { Module } from '@nestjs/common';
import { BloodStocksController } from './blood-stocks.controller';
import { BloodStocksService } from './blood-stocks.service';
import { BloodStocksRepository } from './blood-stocks.repository';

@Module({
  controllers: [BloodStocksController],
  providers: [BloodStocksService, BloodStocksRepository],
  exports: [BloodStocksService, BloodStocksRepository],
})
export class BloodStocksModule {}

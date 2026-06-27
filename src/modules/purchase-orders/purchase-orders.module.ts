import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersRepository } from './purchase-orders.repository';
import { BloodRequestFulfilledListener } from './listeners/blood-request-fulfilled.listener';

@Module({
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    PurchaseOrdersRepository,
    BloodRequestFulfilledListener,
  ],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}

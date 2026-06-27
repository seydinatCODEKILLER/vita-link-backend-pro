import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ListPurchaseOrdersDto } from './dto/list-purchase-orders.dto';
import { ConfirmExpiryDto } from './dto/confirm-expiry.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiGetPurchaseOrders,
  ApiScanPurchaseOrder,
  ApiConfirmExpiry,
  ApiGetPurchaseOrderByBloodRequest,
} from './ purchase-orders.swagger';
import { Role } from '@/generated/prisma/enums';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetPurchaseOrders()
  getList(
    @Query() dto: ListPurchaseOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getList(user, dto);
  }

  @Post(':id/expire-confirm')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiConfirmExpiry()
  confirmExpiry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmExpiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.confirmExpiry(id, dto, user);
  }

  @Post(':code/scan')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiScanPurchaseOrder()
  scan(@Param('code') code: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.scan(code, user);
  }

  @Get(':bloodRequestId')
  @Roles(Role.HOSPITAL_AGENT)
  @ApiGetPurchaseOrderByBloodRequest()
  getByBloodRequest(
    @Param('bloodRequestId', ParseUUIDPipe) bloodRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getByBloodRequest(bloodRequestId, user);
  }
}

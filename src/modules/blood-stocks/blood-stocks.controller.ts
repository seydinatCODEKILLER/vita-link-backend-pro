import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BloodStocksService } from './blood-stocks.service';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ListStocksDto } from './dto/list-stocks.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiGetMyStocks,
  ApiUpdateMyStock,
  ApiGetAllStocks,
} from './blood-stocks.swagger';
import { Role } from '@/generated/prisma/enums';

@ApiTags('Blood Stocks')
@ApiBearerAuth()
@Controller('blood-stocks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BloodStocksController {
  constructor(private readonly service: BloodStocksService) {}

  @Get('me')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetMyStocks()
  getMyStocks(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyStocks(user);
  }

  @Patch('me')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiUpdateMyStock()
  updateMyStock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStockDto,
  ) {
    return this.service.updateMyStock(user, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiGetAllStocks()
  getAllStocks(@Query() dto: ListStocksDto) {
    return this.service.getAllStocks(dto);
  }
}

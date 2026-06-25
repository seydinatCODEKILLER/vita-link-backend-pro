import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { ListNearbyAlertsDto } from './dto/list-nearby-alerts.dto';
import { ListStructureAlertsDto } from './dto/list-structure-alerts.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiCloseAlert,
  ApiCreateAlert,
  ApiGetAlertById,
  ApiGetAlertResponses,
  ApiGetMyStructureAlerts,
  ApiGetNearbyAlerts,
} from './alerts.swagger';
import { Role } from '@/generated/prisma/enums';

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Post()
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiCreateAlert()
  createAlert(
    @Body() dto: CreateAlertDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createAlert(dto, user);
  }

  @Get()
  @Roles(Role.DONOR)
  @ApiGetNearbyAlerts()
  getNearbyAlerts(
    @Query() dto: ListNearbyAlertsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getNearbyAlerts(dto, user);
  }

  @Get('my-structure')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetMyStructureAlerts()
  getMyStructureAlerts(
    @Query() dto: ListStructureAlertsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getMyStructureAlerts(user, dto);
  }

  @Get(':id')
  @ApiGetAlertById()
  getAlertById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getAlertById(id);
  }

  @Get(':id/responses')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetAlertResponses()
  getAlertResponses(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getAlertResponses(id, user);
  }

  @Patch(':id/close')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiCloseAlert()
  closeAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.closeAlert(id, user);
  }
}

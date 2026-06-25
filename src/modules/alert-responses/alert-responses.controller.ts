import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AlertResponsesService } from './alert-responses.service';
import { ConfirmResponseDto } from './dto/confirm-response.dto';
import { AgentActionDto } from './dto/agent-action.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiCheckActiveConfirmation,
  ApiConfirmResponse,
  ApiDeclineResponse,
  ApiMarkArrived,
  ApiMarkNoShow,
  ApiCancelConfirmation,
} from './alert-responses.swagger';
import { Role } from '@/generated/prisma/enums';

@ApiTags('Alert Responses')
@ApiBearerAuth()
@Controller('alert-responses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertResponsesController {
  constructor(private readonly service: AlertResponsesService) {}

  @Get('active-confirmation')
  @Roles(Role.DONOR)
  @ApiCheckActiveConfirmation()
  checkActiveConfirmation(@CurrentUser() user: AuthenticatedUser) {
    return this.service.checkActiveConfirmation(user.id);
  }

  @Post(':alertId/confirm')
  @Roles(Role.DONOR)
  @HttpCode(HttpStatus.OK)
  @ApiConfirmResponse()
  confirm(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmResponseDto,
  ) {
    return this.service.confirm(alertId, user.id, dto);
  }

  @Post(':alertId/decline')
  @Roles(Role.DONOR)
  @HttpCode(HttpStatus.OK)
  @ApiDeclineResponse()
  decline(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.decline(alertId, user.id);
  }

  @Patch(':alertId/arrived')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiMarkArrived()
  markArrived(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() dto: AgentActionDto,
  ) {
    return this.service.markArrived(alertId, dto.donorId);
  }

  @Patch(':alertId/no-show')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiMarkNoShow()
  markNoShow(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @Body() dto: AgentActionDto,
  ) {
    return this.service.markNoShow(alertId, dto.donorId);
  }

  @Patch(':alertId/cancel')
  @Roles(Role.DONOR)
  @HttpCode(HttpStatus.OK)
  @ApiCancelConfirmation()
  cancelConfirmation(
    @Param('alertId', ParseUUIDPipe) alertId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelConfirmation(alertId, user.id);
  }
}

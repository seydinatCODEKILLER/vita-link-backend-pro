import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { GetUsersDto } from './dto/get-users.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { GetStructuresDto } from './dto/get-structures.dto';
import { SuspendStructureDto } from './dto/suspend-structure.dto';
import { GetAuditLogsDto } from './dto/get-audit-logs.dto';
import { GetMonthlyStatsDto } from './dto/get-monthly-stats.dto';
import { GetRecentAlertsDto } from './dto/get-recent-alerts.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import { Role } from '@/generated/prisma/enums';
import {
  ApiGetDashboard,
  ApiGetMonthlyStats,
  ApiGetRegionStats,
  ApiGetUsers,
  ApiGetUserById,
  ApiSuspendUser,
  ApiReactivateUser,
  ApiGetStructures,
  ApiVerifyStructure,
  ApiSuspendStructure,
  ApiGetAuditLogs,
  ApiGetRecentAlerts,
} from './admin.swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('dashboard')
  @ApiGetDashboard()
  getDashboard() {
    return this.service.getDashboard();
  }

  @Get('stats/monthly')
  @ApiGetMonthlyStats()
  getMonthlyStats(@Query() dto: GetMonthlyStatsDto) {
    return this.service.getMonthlyStats(dto.year);
  }

  @Get('stats/regions')
  @ApiGetRegionStats()
  getRegionStats() {
    return this.service.getRegionStats();
  }

  @Get('users')
  @ApiGetUsers()
  getUsers(@Query() dto: GetUsersDto) {
    return this.service.getUsers(dto);
  }

  @Get('alerts/recent')
  @ApiGetRecentAlerts()
  getRecentAlerts(@Query() dto: GetRecentAlertsDto) {
    return this.service.getRecentAlerts(dto.limit ?? 10);
  }

  @Get('users/:id')
  @ApiGetUserById()
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getUserById(id);
  }

  @Patch('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiSuspendUser()
  suspendUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.suspendUser(id, user.id, dto.reason);
  }

  @Patch('users/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiReactivateUser()
  reactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reactivateUser(id, user.id);
  }

  @Get('health-structures')
  @ApiGetStructures()
  getStructures(@Query() dto: GetStructuresDto) {
    return this.service.getStructures(dto);
  }

  @Patch('health-structures/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiVerifyStructure()
  verifyStructure(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.verifyStructure(id, user.id);
  }

  @Patch('health-structures/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiSuspendStructure()
  suspendStructure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendStructureDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.suspendStructure(id, user.id, dto.reason);
  }

  @Get('audit-logs')
  @ApiGetAuditLogs()
  getAuditLogs(@Query() dto: GetAuditLogsDto) {
    return this.service.getAuditLogs(dto);
  }
}

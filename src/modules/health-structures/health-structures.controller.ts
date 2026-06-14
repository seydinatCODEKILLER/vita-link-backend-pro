import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { HealthStructuresService } from './health-structures.service';
import { UpdateStructureDto } from './dto/update-structure.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Role } from '@/common/enums/roles.enum';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import { HealthStructureStatus } from '@/generated/prisma/enums';
import {
  ApiAddStaff,
  ApiGetAffiliatedHospitals,
  ApiGetAllStructures,
  ApiGetAvailableCnts,
  ApiGetMyStructure,
  ApiGetStaff,
  ApiGetStats,
  ApiGetStructureById,
  ApiRemoveStaff,
  ApiUpdateMyStructure,
} from './health-structures.swagger';

@ApiTags('Health Structures')
@ApiBearerAuth()
@Controller('health-structures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthStructuresController {
  constructor(private readonly service: HealthStructuresService) {}

  @Public()
  @Get('cnts/available')
  @HttpCode(HttpStatus.OK)
  @ApiGetAvailableCnts()
  getAvailableCnts() {
    return this.service.getAvailableCnts();
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiGetAllStructures()
  getAll() {
    return this.service.getAll();
  }

  @Get('me')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT, Role.HOSPITAL_AGENT)
  @ApiGetMyStructure()
  getMyStructure(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyStructure(user.id);
  }

  @Patch('me')
  @Roles(Role.CNTS_ADMIN, Role.HOSPITAL_AGENT)
  @ApiUpdateMyStructure()
  updateMyStructure(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStructureDto,
  ) {
    return this.service.updateMyStructure(user, dto);
  }

  @Get('me/staff')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT, Role.HOSPITAL_AGENT)
  @ApiGetStaff()
  getStaff(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStaff(user);
  }

  @Post('me/staff')
  @Roles(Role.CNTS_ADMIN, Role.HOSPITAL_AGENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiAddStaff()
  addStaff(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddStaffDto) {
    return this.service.addStaff(user, dto);
  }

  @Delete('me/staff/:userId')
  @Roles(Role.CNTS_ADMIN, Role.HOSPITAL_AGENT)
  @ApiRemoveStaff()
  removeStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.removeStaff(user, userId);
  }

  @Get('me/affiliated-hospitals')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT)
  @ApiGetAffiliatedHospitals()
  getAffiliatedHospitals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: HealthStructureStatus,
  ) {
    return this.service.getAffiliatedHospitals(user, { status });
  }

  @Get('me/stats')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT, Role.HOSPITAL_AGENT)
  @ApiGetStats()
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getStats(user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.CNTS_ADMIN, Role.CNTS_AGENT, Role.HOSPITAL_AGENT)
  @ApiGetStructureById()
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CntsDashboardDto } from './dto/cnts-dashboard.dto';
import { HospitalDashboardDto } from './dto/hospital-dashboard.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiGetCntsDashboard,
  ApiGetHospitalDashboard,
} from './dashboard.swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('cnts')
  @ApiGetCntsDashboard()
  getCntsDashboard(
    @Query() dto: CntsDashboardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getCntsDashboard(user, dto);
  }

  @Get('hospital')
  @ApiGetHospitalDashboard()
  getHospitalDashboard(
    @Query() dto: HospitalDashboardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getHospitalDashboard(user, dto);
  }
}

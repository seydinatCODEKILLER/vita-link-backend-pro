import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JambaarsService } from './jambaar-profile.service';
import { LeaderboardDto } from './dto/leaderboard.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiGetMyProfile,
  ApiGetMyBadges,
  ApiGetLeaderboard,
} from './jambaar-profile.swagger';
import { Role } from '@/generated/prisma/enums';

@ApiTags('Jambaar Profile')
@ApiBearerAuth()
@Controller('jambaar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JambaarsController {
  constructor(private readonly service: JambaarsService) {}

  @Get('me')
  @Roles(Role.DONOR)
  @ApiGetMyProfile()
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyProfile(user.id);
  }

  @Get('me/badges')
  @Roles(Role.DONOR)
  @ApiGetMyBadges()
  getMyBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyBadges(user.id);
  }

  @Get('leaderboard')
  @ApiGetLeaderboard()
  getLeaderboard(
    @Query() dto: LeaderboardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getLeaderboard(dto, user.id);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import { Role } from '@/generated/prisma/enums';
import {
  ApiListRewards,
  ApiGetRewardById,
  ApiCreateReward,
  ApiUpdateReward,
  ApiDeactivateReward,
} from './rewards.swagger';

@ApiTags('Rewards')
@ApiBearerAuth()
@Controller('rewards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RewardsController {
  constructor(private readonly service: RewardsService) {}

  @Get()
  @ApiListRewards()
  listRewards(@CurrentUser() user: AuthenticatedUser) {
    return user.role === Role.ADMIN
      ? this.service.listAllRewards()
      : this.service.listAvailableRewards();
  }

  @Get(':id')
  @ApiGetRewardById()
  getRewardById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getRewardById(id, user.role);
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateReward()
  createReward(@Body() dto: CreateRewardDto) {
    return this.service.createReward(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiUpdateReward()
  updateReward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.service.updateReward(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiDeactivateReward()
  deactivateReward(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivateReward(id);
  }
}

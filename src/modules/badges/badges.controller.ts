import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BadgesService } from './badges.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/generated/prisma/enums';
import {
  ApiListBadges,
  ApiCreateBadge,
  ApiUpdateBadge,
  ApiDeactivateBadge,
  ApiReactivateBadge,
} from './badges.swagger';

@ApiTags('Badges')
@ApiBearerAuth()
@Controller('badges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class BadgesController {
  constructor(private readonly service: BadgesService) {}

  @Get()
  @ApiListBadges()
  listBadges() {
    return this.service.listBadges();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateBadge()
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.service.createBadge(dto);
  }

  @Patch(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiReactivateBadge()
  reactivateBadge(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivateBadge(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateBadge()
  updateBadge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBadgeDto,
  ) {
    return this.service.updateBadge(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiDeactivateBadge()
  deactivateBadge(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivateBadge(id);
  }
}

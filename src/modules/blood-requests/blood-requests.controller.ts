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
import { BloodRequestsService } from './blood-requests.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { HandleBloodRequestDto } from './dto/handle-blood-request.dto';
import { ListBloodRequestsDto } from './dto/list-blood-requests.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import { Role } from '@/generated/prisma/enums';
import {
  ApiCreateBloodRequest,
  ApiGetBloodRequests,
  ApiHandleBloodRequest,
  ApiCancelBloodRequest,
  ApiGetBloodRequestById,
} from './blood-requests.swagger';

@ApiTags('Blood Requests')
@ApiBearerAuth()
@Controller('blood-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BloodRequestsController {
  constructor(private readonly service: BloodRequestsService) {}

  @Post()
  @Roles(Role.HOSPITAL_AGENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateBloodRequest()
  createRequest(
    @Body() dto: CreateBloodRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createRequest(dto, user);
  }

  @Get()
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetBloodRequests()
  getRequests(
    @Query() dto: ListBloodRequestsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getRequests(user, dto);
  }

  @Post(':id/handle')
  @Roles(Role.CNTS_ADMIN, Role.CNTS_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiHandleBloodRequest()
  handleRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HandleBloodRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.handleRequest(id, dto, user);
  }

  @Patch(':id/cancel')
  @Roles(Role.HOSPITAL_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiCancelBloodRequest()
  cancelRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelRequest(id, user);
  }

  @Get(':id')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetBloodRequestById()
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getById(id, user);
  }
}

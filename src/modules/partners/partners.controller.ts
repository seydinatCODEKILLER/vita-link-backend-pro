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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { logoInterceptor } from './logo.interceptor';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import { Role } from '@/generated/prisma/enums';
import {
  ApiListPartners,
  ApiGetPartnerById,
  ApiCreatePartner,
  ApiUpdatePartner,
  ApiDeactivatePartner,
} from './partners.swagger';

@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartnersController {
  constructor(private readonly service: PartnersService) {}

  @Get()
  @ApiListPartners()
  listPartners(@CurrentUser() user: AuthenticatedUser) {
    return user.role === Role.ADMIN
      ? this.service.listAllPartners()
      : this.service.listActivePartners();
  }

  @Get(':id')
  @ApiGetPartnerById()
  getPartnerById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getPartnerById(id, user.role);
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(logoInterceptor)
  @ApiCreatePartner()
  createPartner(
    @Body() dto: CreatePartnerDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createPartner(dto, file, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(logoInterceptor)
  @ApiUpdatePartner()
  updatePartner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.service.updatePartner(id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiDeactivatePartner()
  deactivatePartner(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivatePartner(id);
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { ScanDonationDto } from './dto/scan-donation.dto';
import { ListDonationsDto } from './dto/list-donations.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiScanDonation,
  ApiGetMyDonations,
  ApiGetStructureDonations,
  ApiGetDonationById,
} from './donations.swagger';
import { Role } from '@/generated/prisma/enums';

@ApiTags('Donations')
@ApiBearerAuth()
@Controller('donations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DonationsController {
  constructor(private readonly service: DonationsService) {}

  @Post('scan')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiScanDonation()
  scan(@Body() dto: ScanDonationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.scanAndValidate(dto, user);
  }

  @Get('me')
  @Roles(Role.DONOR)
  @ApiGetMyDonations()
  getMyDonations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListDonationsDto,
  ) {
    return this.service.getMyDonations(user.id, dto);
  }

  @Get('structure')
  @Roles(Role.CNTS_AGENT, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT, Role.ADMIN)
  @ApiGetStructureDonations()
  getStructureDonations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListDonationsDto,
  ) {
    return this.service.getStructureDonations(user, dto);
  }

  @Get(':id')
  @ApiGetDonationById()
  getDonationById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getDonationById(id, user);
  }
}

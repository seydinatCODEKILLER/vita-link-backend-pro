import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { ListCouponsDto } from './dto/list-coupons.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import { Role } from '@/generated/prisma/enums';
import {
  ApiRedeemReward,
  ApiGetMyCoupons,
  ApiUseCoupon,
} from './coupons.swagger';

@ApiTags('Coupons')
@ApiBearerAuth()
@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(private readonly service: CouponsService) {}

  @Post('redeem/:rewardId')
  @Roles(Role.DONOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiRedeemReward()
  redeemReward(
    @Param('rewardId', ParseUUIDPipe) rewardId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.redeemReward(user.id, rewardId);
  }

  @Get('me')
  @Roles(Role.DONOR)
  @ApiGetMyCoupons()
  getMyCoupons(
    @Query() dto: ListCouponsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getMyCoupons(user.id, dto);
  }

  @Patch(':id/use')
  @Roles(Role.ADMIN, Role.CNTS_ADMIN, Role.HOSPITAL_AGENT)
  @HttpCode(HttpStatus.OK)
  @ApiUseCoupon()
  useCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.useCoupon(id, user);
  }
}

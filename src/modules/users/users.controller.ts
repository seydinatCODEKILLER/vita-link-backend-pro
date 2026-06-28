import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateExpoTokenDto } from './dto/update-expo-token.dto';
import { avatarInterceptor } from './avatar.interceptor';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiDeleteMe,
  ApiGetActiveEngagement,
  ApiGetMe,
  ApiUpdateAvailability,
  ApiUpdateAvatar,
  ApiUpdateExpoToken,
  ApiUpdateLocation,
  ApiUpdateProfile,
} from './users.swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('me')
  @ApiGetMe()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMe(user.id);
  }

  @Get('me/active-engagement')
  @ApiGetActiveEngagement()
  getActiveEngagement(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getActiveEngagement(user.id, user.role);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateProfile()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.service.updateProfile(user.id, dto);
  }

  @Patch('me/avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(avatarInterceptor)
  @ApiUpdateAvatar()
  updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.updateAvatar(user.id, file);
  }

  @Patch('me/location')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateLocation()
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.updateLocation(user.id, dto);
  }

  @Patch('me/availability')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateAvailability()
  updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.service.updateAvailability(user.id, dto, user.role);
  }

  @Patch('me/expo-token')
  @HttpCode(HttpStatus.OK)
  @ApiUpdateExpoToken()
  updateExpoToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateExpoTokenDto,
  ) {
    return this.service.updateExpoToken(user.id, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiDeleteMe()
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteMe(user.id, user.role);
  }
}

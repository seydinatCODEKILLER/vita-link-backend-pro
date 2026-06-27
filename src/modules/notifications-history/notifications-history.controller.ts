import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsHistoryService } from './notifications-history.service';
import { ListMyNotificationsDto } from './dto/list-my-notifications.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@/common/types/request-with-user.type';
import {
  ApiGetMyNotifications,
  ApiMarkAsRead,
  ApiDeleteAllMyNotifications,
} from './notifications-history.swagger';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsHistoryController {
  constructor(private readonly service: NotificationsHistoryService) {}

  @Get('me')
  @ApiGetMyNotifications()
  getMyNotifications(
    @Query() dto: ListMyNotificationsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getMyNotifications(user.id, dto);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiMarkAsRead()
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.markAsRead(id, user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiDeleteAllMyNotifications()
  deleteAllMyNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteAllMyNotifications(user.id);
  }
}

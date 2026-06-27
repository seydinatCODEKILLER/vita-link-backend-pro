import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { UpdateExpoTokenDto } from './dto/update-expo-token.dto';
import { Role } from '@/generated/prisma/enums';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly repository: UsersRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async getMe(userId: string) {
    const user = await this.repository.findMe(userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async getActiveEngagement(userId: string, role: Role) {
    if (role !== Role.DONOR) {
      throw new ForbiddenException('Réservé aux donneurs');
    }
    return this.repository.findActiveEngagement(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.dateOfBirth) {
      data['dateOfBirth'] = new Date(dto.dateOfBirth);
    }

    const user = await this.repository.updateProfile(userId, data);
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    this.logger.log(`PROFILE_UPDATED — ${userId}`);
    return user;
  }

  async updateAvatar(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Aucune image fournie');

    const currentUser = await this.repository.findMe(userId);

    let uploadResult: { url: string; publicId: string };
    try {
      uploadResult = await this.cloudinary.upload(
        file,
        'vita-link/avatars',
        `avatar_${userId}`,
      );
    } catch {
      throw new BadRequestException("Échec de l'upload de l'image");
    }

    if (currentUser?.avatarUrl) {
      await this.cloudinary.deleteByUrl(currentUser.avatarUrl);
    }

    const user = await this.repository.updateAvatar(userId, uploadResult.url);

    this.logger.log(`AVATAR_UPDATED — ${userId} — ${uploadResult.url}`);
    return user;
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const updated = await this.repository.updateLocation(
      userId,
      dto.latitude,
      dto.longitude,
    );

    this.logger.log(`LOCATION_UPDATED — ${userId}`);
    return updated;
  }

  async updateAvailability(
    userId: string,
    dto: UpdateAvailabilityDto,
    role: Role,
  ) {
    if (role !== Role.DONOR) {
      throw new ForbiddenException(
        'La disponibilité est réservée aux donneurs',
      );
    }

    const updated = await this.repository.updateAvailability(
      userId,
      dto.isAvailable,
    );

    this.logger.log(`AVAILABILITY_UPDATED — ${userId} — ${dto.isAvailable}`);
    return updated;
  }

  async updateExpoToken(userId: string, dto: UpdateExpoTokenDto) {
    const updated = await this.repository.updateExpoToken(
      userId,
      dto.expoPushToken,
    );

    this.logger.log(`EXPO_TOKEN_UPDATED — ${userId}`);
    return updated;
  }

  async deleteMe(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      throw new ForbiddenException(
        'Les administrateurs ne peuvent pas supprimer leur compte via cette route',
      );
    }

    await this.repository.softDelete(userId);

    this.logger.log(`ACCOUNT_DELETED — ${userId} — ${role}`);
    return {
      message: 'Votre compte a été supprimé. Vos données ont été anonymisées.',
    };
  }
}

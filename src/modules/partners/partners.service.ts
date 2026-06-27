import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PartnersRepository } from './partners.repository';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { Role } from '@/generated/prisma/enums';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly repository: PartnersRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  listActivePartners() {
    return this.repository.findAllActive();
  }

  listAllPartners() {
    return this.repository.findAllForAdmin();
  }

  async getPartnerById(id: string, userRole: Role) {
    const partner = await this.repository.findPartnerById(id);
    if (!partner) throw new NotFoundException('Partenaire introuvable');

    if (!partner.isActive && userRole !== Role.ADMIN) {
      throw new NotFoundException('Partenaire introuvable');
    }

    return partner;
  }

  async createPartner(
    dto: CreatePartnerDto,
    file: Express.Multer.File | undefined,
    adminId: string,
  ) {
    const existing = await this.repository.findByName(dto.name);
    if (existing) {
      throw new ConflictException(
        `Un partenaire avec le nom "${dto.name}" existe déjà`,
      );
    }

    let logoUrl: string | null = null;
    let uploadedPublicId: string | null = null;

    if (file) {
      try {
        const result = await this.cloudinary.upload(
          file,
          'vita-link/partners',
          'partner_logo',
        );
        logoUrl = result.url;
        uploadedPublicId = result.publicId;
      } catch {
        throw new BadRequestException("Échec de l'upload du logo");
      }
    }

    try {
      const partner = await this.repository.createPartner({
        ...dto,
        logoUrl,
        managedByUserId: adminId,
      });

      this.logger.log(`PARTNER_CREATED — ${partner.id} — ${partner.name}`);
      return partner;
    } catch (err) {
      if (uploadedPublicId) {
        await this.cloudinary.deleteByPublicId(uploadedPublicId);
        this.logger.warn(`Rollback logo Cloudinary — ${uploadedPublicId}`);
      }
      throw err;
    }
  }

  async updatePartner(
    id: string,
    dto: UpdatePartnerDto,
    file: Express.Multer.File | undefined,
  ) {
    const existing = await this.repository.findPartnerById(id);
    if (!existing) throw new NotFoundException('Partenaire introuvable');

    if (dto.name && dto.name !== existing.name) {
      const nameConflict = await this.repository.findByName(dto.name);
      if (nameConflict) {
        throw new ConflictException(
          `Un partenaire avec le nom "${dto.name}" existe déjà`,
        );
      }
    }

    let logoUrl = existing.logoUrl;
    let newPublicId: string | null = null;

    if (file) {
      try {
        const result = await this.cloudinary.upload(
          file,
          'vita-link/partners',
          'partner_logo',
        );
        logoUrl = result.url;
        newPublicId = result.publicId;
      } catch {
        throw new BadRequestException("Échec de l'upload du logo");
      }
    }

    try {
      const partner = await this.repository.updatePartner(id, {
        ...dto,
        logoUrl,
      });

      if (file && existing.logoUrl) {
        await this.cloudinary.deleteByUrl(existing.logoUrl);
      }

      this.logger.log(`PARTNER_UPDATED — ${partner.id}`);
      return partner;
    } catch (err) {
      if (newPublicId) {
        await this.cloudinary.deleteByPublicId(newPublicId);
        this.logger.warn(`Rollback logo Cloudinary — ${newPublicId}`);
      }
      throw err;
    }
  }

  async deactivatePartner(id: string) {
    const existing = await this.repository.findPartnerById(id);
    if (!existing) throw new NotFoundException('Partenaire introuvable');

    if (!existing.isActive) {
      throw new ConflictException('Ce partenaire est déjà désactivé');
    }

    const partner = await this.repository.softDelete(id);

    this.logger.log(`PARTNER_DEACTIVATED — ${partner.id}`);
    return partner;
  }
}

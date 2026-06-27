import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@/common/base/base.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';

const PARTNER_PUBLIC_SELECT = {
  id: true,
  name: true,
  description: true,
  logoUrl: true,
  websiteUrl: true,
} as const;

const PARTNER_ADMIN_SELECT = {
  ...PARTNER_PUBLIC_SELECT,
  isActive: true,
  managedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  createdAt: true,
  updatedAt: true,
} as const;

const PARTNER_STATUS_SELECT = {
  id: true,
  name: true,
  isActive: true,
} as const;

export type PartnerPublic = Prisma.PartnerGetPayload<{
  select: typeof PARTNER_PUBLIC_SELECT;
}>;

export type PartnerAdminDetail = Prisma.PartnerGetPayload<{
  select: typeof PARTNER_ADMIN_SELECT;
}>;

export type PartnerStatus = Prisma.PartnerGetPayload<{
  select: typeof PARTNER_STATUS_SELECT;
}>;

@Injectable()
export class PartnersRepository extends BaseRepository<
  PrismaService['partner']
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.partner);
  }

  findAllActive(): Promise<PartnerPublic[]> {
    return this.model.findMany({
      where: { isActive: true },
      select: PARTNER_PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  findAllForAdmin(): Promise<PartnerAdminDetail[]> {
    return this.model.findMany({
      select: PARTNER_ADMIN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  findPartnerById(id: string): Promise<PartnerAdminDetail | null> {
    return this.model.findUnique({
      where: { id },
      select: PARTNER_ADMIN_SELECT,
    });
  }

  findByName(name: string): Promise<{ id: string; name: string } | null> {
    return this.model.findUnique({
      where: { name },
      select: { id: true, name: true },
    });
  }

  createPartner(data: {
    name: string;
    description?: string;
    websiteUrl?: string;
    logoUrl?: string | null;
    managedByUserId: string;
  }): Promise<PartnerAdminDetail> {
    return this.model.create({
      data,
      select: PARTNER_ADMIN_SELECT,
    });
  }

  updatePartner(
    id: string,
    data: {
      name?: string;
      description?: string;
      websiteUrl?: string;
      logoUrl?: string | null;
    },
  ): Promise<PartnerAdminDetail> {
    return this.model.update({
      where: { id },
      data,
      select: PARTNER_ADMIN_SELECT,
    });
  }

  softDelete(id: string): Promise<PartnerStatus> {
    return this.model.update({
      where: { id },
      data: { isActive: false },
      select: PARTNER_STATUS_SELECT,
    });
  }
}

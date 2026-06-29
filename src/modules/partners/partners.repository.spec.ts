import { Test, TestingModule } from '@nestjs/testing';
import { PartnersRepository } from './partners.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  partner: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

const PARTNER_PUBLIC = {
  id: 'partner-1',
  name: 'Orange Sonatel',
  description: 'Leader des télécoms au Sénégal',
  logoUrl: 'https://res.cloudinary.com/vita-link/partners/orange.png',
  websiteUrl: 'https://orange.sn',
};

const PARTNER_ADMIN = {
  ...PARTNER_PUBLIC,
  isActive: true,
  managedBy: { id: 'admin-1', firstName: 'Fatou', lastName: 'Ndiaye' },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const PARTNER_STATUS = {
  id: 'partner-1',
  name: 'Orange Sonatel',
  isActive: false,
};

describe('PartnersRepository', () => {
  let repository: PartnersRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(PartnersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllActive', () => {
    it('appelle findMany avec isActive true et tri par name asc', async () => {
      prisma.partner.findMany.mockResolvedValue([PARTNER_PUBLIC]);

      const result = await repository.findAllActive();

      expect(prisma.partner.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: expect.objectContaining({ id: true, name: true }),
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([PARTNER_PUBLIC]);
    });
  });

  describe('findAllForAdmin', () => {
    it('appelle findMany avec le select admin et tri par createdAt desc', async () => {
      prisma.partner.findMany.mockResolvedValue([PARTNER_ADMIN]);

      const result = await repository.findAllForAdmin();

      expect(prisma.partner.findMany).toHaveBeenCalledWith({
        select: expect.objectContaining({
          id: true,
          isActive: true,
          createdAt: true,
        }),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([PARTNER_ADMIN]);
    });
  });

  describe('findPartnerById', () => {
    it('retourne le partenaire avec le select admin complet', async () => {
      prisma.partner.findUnique.mockResolvedValue(PARTNER_ADMIN);

      const result = await repository.findPartnerById('partner-1');

      expect(prisma.partner.findUnique).toHaveBeenCalledWith({
        where: { id: 'partner-1' },
        select: expect.objectContaining({ id: true, isActive: true }),
      });
      expect(result).toEqual(PARTNER_ADMIN);
    });

    it('retourne null si le partenaire est introuvable', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);

      const result = await repository.findPartnerById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('retourne le partenaire trouvé par nom', async () => {
      prisma.partner.findUnique.mockResolvedValue({
        id: 'partner-1',
        name: 'Orange Sonatel',
      });

      const result = await repository.findByName('Orange Sonatel');

      expect(prisma.partner.findUnique).toHaveBeenCalledWith({
        where: { name: 'Orange Sonatel' },
        select: { id: true, name: true },
      });
      expect(result).toEqual({ id: 'partner-1', name: 'Orange Sonatel' });
    });

    it('retourne null si le nom est introuvable', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);

      const result = await repository.findByName('Inconnu');

      expect(result).toBeNull();
    });
  });

  describe('createPartner', () => {
    it('crée le partenaire avec les données fournies et le select admin', async () => {
      const input = {
        name: 'Orange Sonatel',
        description: 'Leader des télécoms',
        websiteUrl: 'https://orange.sn',
        logoUrl: null,
        managedByUserId: 'admin-1',
      };
      prisma.partner.create.mockResolvedValue(PARTNER_ADMIN);

      const result = await repository.createPartner(input);

      expect(prisma.partner.create).toHaveBeenCalledWith({
        data: input,
        select: expect.objectContaining({ id: true, isActive: true }),
      });
      expect(result).toEqual(PARTNER_ADMIN);
    });
  });

  describe('updatePartner', () => {
    it('ne transmet que les champs fournis dans data', async () => {
      const updated = { ...PARTNER_ADMIN, name: 'Orange Sénégal' };
      prisma.partner.update.mockResolvedValue(updated);

      const result = await repository.updatePartner('partner-1', {
        name: 'Orange Sénégal',
      });

      expect(prisma.partner.update).toHaveBeenCalledWith({
        where: { id: 'partner-1' },
        data: { name: 'Orange Sénégal' },
        select: expect.objectContaining({ id: true }),
      });
      expect(result).toEqual(updated);
    });
  });

  describe('softDelete', () => {
    it('met isActive à false et retourne le select status', async () => {
      prisma.partner.update.mockResolvedValue(PARTNER_STATUS);

      const result = await repository.softDelete('partner-1');

      expect(prisma.partner.update).toHaveBeenCalledWith({
        where: { id: 'partner-1' },
        data: { isActive: false },
        select: { id: true, name: true, isActive: true },
      });
      expect(result).toEqual(PARTNER_STATUS);
    });
  });
});

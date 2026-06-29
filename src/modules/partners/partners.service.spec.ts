import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersRepository } from './partners.repository';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { Role } from '@/generated/prisma/enums';

const createMockRepository = () => ({
  findAllActive: jest.fn(),
  findAllForAdmin: jest.fn(),
  findPartnerById: jest.fn(),
  findByName: jest.fn(),
  createPartner: jest.fn(),
  updatePartner: jest.fn(),
  softDelete: jest.fn(),
});

const createMockCloudinary = () => ({
  upload: jest.fn(),
  deleteByPublicId: jest.fn(),
  deleteByUrl: jest.fn(),
});

const ACTIVE_PARTNER = {
  id: 'partner-1',
  name: 'Orange Sonatel',
  description: 'Leader des télécoms',
  logoUrl: 'https://res.cloudinary.com/vita-link/partners/orange.png',
  websiteUrl: 'https://orange.sn',
  isActive: true,
  managedBy: { id: 'admin-1', firstName: 'Fatou', lastName: 'Ndiaye' },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const INACTIVE_PARTNER = { ...ACTIVE_PARTNER, isActive: false };

const PARTNER_STATUS = {
  id: 'partner-1',
  name: 'Orange Sonatel',
  isActive: false,
};

const MOCK_FILE = {
  fieldname: 'logo',
  originalname: 'orange.png',
  mimetype: 'image/png',
  buffer: Buffer.from('fake-image'),
  size: 1024,
} as Express.Multer.File;

describe('PartnersService', () => {
  let service: PartnersService;
  let repository: ReturnType<typeof createMockRepository>;
  let cloudinary: ReturnType<typeof createMockCloudinary>;

  beforeEach(async () => {
    repository = createMockRepository();
    cloudinary = createMockCloudinary();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersService,
        { provide: PartnersRepository, useValue: repository },
        { provide: CloudinaryService, useValue: cloudinary },
      ],
    }).compile();

    service = module.get(PartnersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listActivePartners', () => {
    it('délègue au repository findAllActive', async () => {
      repository.findAllActive.mockResolvedValue([ACTIVE_PARTNER]);

      const result = await service.listActivePartners();

      expect(repository.findAllActive).toHaveBeenCalledTimes(1);
      expect(result).toEqual([ACTIVE_PARTNER]);
    });
  });

  describe('listAllPartners', () => {
    it('délègue au repository findAllForAdmin', async () => {
      repository.findAllForAdmin.mockResolvedValue([
        ACTIVE_PARTNER,
        INACTIVE_PARTNER,
      ]);

      const result = await service.listAllPartners();

      expect(repository.findAllForAdmin).toHaveBeenCalledTimes(1);
      expect(result).toEqual([ACTIVE_PARTNER, INACTIVE_PARTNER]);
    });
  });

  describe('getPartnerById', () => {
    it('retourne le partenaire actif pour un donneur', async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);

      const result = await service.getPartnerById('partner-1', Role.DONOR);

      expect(result).toEqual(ACTIVE_PARTNER);
    });

    it('retourne un partenaire inactif pour un admin', async () => {
      repository.findPartnerById.mockResolvedValue(INACTIVE_PARTNER);

      const result = await service.getPartnerById('partner-1', Role.ADMIN);

      expect(result).toEqual(INACTIVE_PARTNER);
    });

    it('lève NotFoundException pour un non-admin si le partenaire est inactif', async () => {
      repository.findPartnerById.mockResolvedValue(INACTIVE_PARTNER);

      await expect(
        service.getPartnerById('partner-1', Role.DONOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève NotFoundException si le partenaire n'existe pas", async () => {
      repository.findPartnerById.mockResolvedValue(null);

      await expect(
        service.getPartnerById('inexistant', Role.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPartner', () => {
    it('crée le partenaire sans logo si aucun fichier fourni', async () => {
      repository.findByName.mockResolvedValue(null);
      repository.createPartner.mockResolvedValue(ACTIVE_PARTNER);

      const dto = { name: 'Orange Sonatel' };
      const result = await service.createPartner(dto, undefined, 'admin-1');

      expect(cloudinary.upload).not.toHaveBeenCalled();
      expect(repository.createPartner).toHaveBeenCalledWith({
        ...dto,
        logoUrl: null,
        managedByUserId: 'admin-1',
      });
      expect(result).toEqual(ACTIVE_PARTNER);
    });

    it('uploade le logo et crée le partenaire avec logoUrl', async () => {
      repository.findByName.mockResolvedValue(null);
      cloudinary.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/vita-link/partners/orange.png',
        publicId: 'vita-link/partners/orange',
      });
      repository.createPartner.mockResolvedValue(ACTIVE_PARTNER);

      const dto = { name: 'Orange Sonatel' };
      const result = await service.createPartner(dto, MOCK_FILE, 'admin-1');

      expect(cloudinary.upload).toHaveBeenCalledWith(
        MOCK_FILE,
        'vita-link/partners',
        'partner_logo',
      );
      expect(repository.createPartner).toHaveBeenCalledWith(
        expect.objectContaining({
          logoUrl: 'https://res.cloudinary.com/vita-link/partners/orange.png',
        }),
      );
      expect(result).toEqual(ACTIVE_PARTNER);
    });

    it('lève ConflictException si un partenaire avec ce nom existe déjà', async () => {
      repository.findByName.mockResolvedValue({
        id: 'partner-1',
        name: 'Orange Sonatel',
      });

      await expect(
        service.createPartner({ name: 'Orange Sonatel' }, undefined, 'admin-1'),
      ).rejects.toThrow(ConflictException);

      expect(repository.createPartner).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si l'upload du logo échoue", async () => {
      repository.findByName.mockResolvedValue(null);
      cloudinary.upload.mockRejectedValue(new Error('Cloudinary error'));

      await expect(
        service.createPartner({ name: 'Orange Sonatel' }, MOCK_FILE, 'admin-1'),
      ).rejects.toThrow(BadRequestException);

      expect(repository.createPartner).not.toHaveBeenCalled();
    });

    it('effectue un rollback du logo si la création en base échoue', async () => {
      repository.findByName.mockResolvedValue(null);
      cloudinary.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/vita-link/partners/orange.png',
        publicId: 'vita-link/partners/orange',
      });
      repository.createPartner.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createPartner({ name: 'Orange Sonatel' }, MOCK_FILE, 'admin-1'),
      ).rejects.toThrow('DB error');

      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith(
        'vita-link/partners/orange',
      );
    });
  });

  describe('updatePartner', () => {
    it('met à jour le partenaire sans changer le logo si aucun fichier fourni', async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);
      repository.findByName.mockResolvedValue(null);
      const updated = { ...ACTIVE_PARTNER, name: 'Orange Sénégal' };
      repository.updatePartner.mockResolvedValue(updated);

      const result = await service.updatePartner(
        'partner-1',
        { name: 'Orange Sénégal' },
        undefined,
      );

      expect(cloudinary.upload).not.toHaveBeenCalled();
      expect(repository.updatePartner).toHaveBeenCalledWith(
        'partner-1',
        expect.objectContaining({ logoUrl: ACTIVE_PARTNER.logoUrl }),
      );
      expect(result).toEqual(updated);
    });

    it("uploade le nouveau logo, met à jour et supprime l'ancien logo", async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);
      repository.findByName.mockResolvedValue(null);
      cloudinary.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/vita-link/partners/new-orange.png',
        publicId: 'vita-link/partners/new-orange',
      });
      repository.updatePartner.mockResolvedValue(ACTIVE_PARTNER);

      await service.updatePartner('partner-1', {}, MOCK_FILE);

      expect(cloudinary.upload).toHaveBeenCalledWith(
        MOCK_FILE,
        'vita-link/partners',
        'partner_logo',
      );
      expect(cloudinary.deleteByUrl).toHaveBeenCalledWith(
        ACTIVE_PARTNER.logoUrl,
      );
    });

    it('lève ConflictException si le nouveau nom est déjà pris', async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);
      repository.findByName.mockResolvedValue({
        id: 'partner-2',
        name: 'Free Sénégal',
      });

      await expect(
        service.updatePartner('partner-1', { name: 'Free Sénégal' }, undefined),
      ).rejects.toThrow(ConflictException);

      expect(repository.updatePartner).not.toHaveBeenCalled();
    });

    it("ne vérifie pas le nom si c'est le même que l'existant", async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);
      repository.updatePartner.mockResolvedValue(ACTIVE_PARTNER);

      await service.updatePartner(
        'partner-1',
        { name: 'Orange Sonatel' },
        undefined,
      );

      expect(repository.findByName).not.toHaveBeenCalled();
    });

    it("lève NotFoundException si le partenaire n'existe pas", async () => {
      repository.findPartnerById.mockResolvedValue(null);

      await expect(
        service.updatePartner('inexistant', {}, undefined),
      ).rejects.toThrow(NotFoundException);

      expect(repository.updatePartner).not.toHaveBeenCalled();
    });

    it('effectue un rollback du nouveau logo si la mise à jour en base échoue', async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);
      repository.findByName.mockResolvedValue(null);
      cloudinary.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/vita-link/partners/new-orange.png',
        publicId: 'vita-link/partners/new-orange',
      });
      repository.updatePartner.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updatePartner('partner-1', {}, MOCK_FILE),
      ).rejects.toThrow('DB error');

      expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith(
        'vita-link/partners/new-orange',
      );
    });
  });

  describe('deactivatePartner', () => {
    it('désactive un partenaire actif', async () => {
      repository.findPartnerById.mockResolvedValue(ACTIVE_PARTNER);
      repository.softDelete.mockResolvedValue(PARTNER_STATUS);

      const result = await service.deactivatePartner('partner-1');

      expect(repository.softDelete).toHaveBeenCalledWith('partner-1');
      expect(result).toEqual(PARTNER_STATUS);
    });

    it("lève NotFoundException si le partenaire n'existe pas", async () => {
      repository.findPartnerById.mockResolvedValue(null);

      await expect(service.deactivatePartner('inexistant')).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('lève ConflictException si le partenaire est déjà désactivé', async () => {
      repository.findPartnerById.mockResolvedValue(INACTIVE_PARTNER);

      await expect(service.deactivatePartner('partner-1')).rejects.toThrow(
        ConflictException,
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});

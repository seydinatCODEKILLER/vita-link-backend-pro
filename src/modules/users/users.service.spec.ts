import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { Role } from '@/generated/prisma/enums';

const createMockRepository = () => ({
  findMe: jest.fn(),
  updateProfile: jest.fn(),
  updateAvatar: jest.fn(),
  updateLocation: jest.fn(),
  updateAvailability: jest.fn(),
  updateExpoToken: jest.fn(),
  softDelete: jest.fn(),
  findActiveEngagement: jest.fn(),
});

const createMockCloudinary = () => ({
  upload: jest.fn(),
  deleteByUrl: jest.fn(),
  deleteByPublicId: jest.fn(),
});

const ME_DATA = {
  id: 'user-1',
  email: 'aliou@gmail.com',
  phone: '+221771234567',
  firstName: 'Aliou',
  lastName: 'Diallo',
  role: Role.DONOR,
  avatarUrl: 'https://res.cloudinary.com/vita-link/avatars/old.jpg',
  bloodType: 'O_NEG',
  isAvailable: true,
  isActive: true,
  latitude: 14.6937,
  longitude: -17.4441,
  jambaarsProfile: {
    totalPoints: 150,
    currentGrade: 'SENTINELLE',
    donationCount: 3,
    livesSavedEstimate: 9,
  },
  employerStructure: null,
};

const MOCK_FILE = {
  fieldname: 'avatar',
  originalname: 'avatar.png',
  mimetype: 'image/png',
  buffer: Buffer.from('fake-image'),
  size: 1024,
} as Express.Multer.File;

describe('UsersService', () => {
  let service: UsersService;
  let repository: ReturnType<typeof createMockRepository>;
  let cloudinary: ReturnType<typeof createMockCloudinary>;

  beforeEach(async () => {
    repository = createMockRepository();
    cloudinary = createMockCloudinary();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: CloudinaryService, useValue: cloudinary },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('retourne le profil complet', async () => {
      repository.findMe.mockResolvedValue(ME_DATA);

      const result = await service.getMe('user-1');

      expect(repository.findMe).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(ME_DATA);
    });

    it("lève NotFoundException si l'utilisateur est introuvable", async () => {
      repository.findMe.mockResolvedValue(null);

      await expect(service.getMe('inexistant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveEngagement', () => {
    it("retourne l'engagement actif pour un donneur", async () => {
      const engagement = {
        id: 'response-1',
        qrCode: 'data:...',
        etaMinutes: 15,
      };
      repository.findActiveEngagement.mockResolvedValue(engagement);

      const result = await service.getActiveEngagement('user-1', Role.DONOR);

      expect(repository.findActiveEngagement).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(engagement);
    });

    it('lève ForbiddenException pour un non-donneur', async () => {
      await expect(
        service.getActiveEngagement('user-1', Role.ADMIN),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.findActiveEngagement).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('met à jour le profil et convertit dateOfBirth en Date', async () => {
      repository.updateProfile.mockResolvedValue(ME_DATA);

      await service.updateProfile('user-1', { dateOfBirth: '1995-06-15' });

      expect(repository.updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ dateOfBirth: expect.any(Date) }),
      );
    });

    it('met à jour le profil sans dateOfBirth', async () => {
      repository.updateProfile.mockResolvedValue(ME_DATA);

      await service.updateProfile('user-1', { firstName: 'Moussa' });

      expect(repository.updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ firstName: 'Moussa' }),
      );
    });

    it("lève NotFoundException si l'utilisateur est introuvable", async () => {
      repository.updateProfile.mockResolvedValue(null);

      await expect(
        service.updateProfile('inexistant', { firstName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateAvatar', () => {
    it("uploade le nouvel avatar, supprime l'ancien et retourne le résultat", async () => {
      repository.findMe.mockResolvedValue(ME_DATA);
      cloudinary.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/vita-link/avatars/new.jpg',
        publicId: 'vita-link/avatars/avatar_user-1',
      });
      repository.updateAvatar.mockResolvedValue({
        id: 'user-1',
        avatarUrl: 'https://res.cloudinary.com/vita-link/avatars/new.jpg',
      });

      const result = await service.updateAvatar('user-1', MOCK_FILE);

      expect(cloudinary.upload).toHaveBeenCalledWith(
        MOCK_FILE,
        'vita-link/avatars',
        'avatar_user-1',
      );
      expect(cloudinary.deleteByUrl).toHaveBeenCalledWith(ME_DATA.avatarUrl);
      expect(result.avatarUrl).toBe(
        'https://res.cloudinary.com/vita-link/avatars/new.jpg',
      );
    });

    it("ne supprime pas l'ancien avatar s'il n'existe pas", async () => {
      repository.findMe.mockResolvedValue({ ...ME_DATA, avatarUrl: null });
      cloudinary.upload.mockResolvedValue({
        url: 'https://res.cloudinary.com/vita-link/avatars/new.jpg',
        publicId: 'vita-link/avatars/avatar_user-1',
      });
      repository.updateAvatar.mockResolvedValue({
        id: 'user-1',
        avatarUrl: 'https://res.cloudinary.com/vita-link/avatars/new.jpg',
      });

      await service.updateAvatar('user-1', MOCK_FILE);

      expect(cloudinary.deleteByUrl).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si aucun fichier fourni', async () => {
      await expect(service.updateAvatar('user-1', undefined)).rejects.toThrow(
        BadRequestException,
      );

      expect(cloudinary.upload).not.toHaveBeenCalled();
    });

    it("lève BadRequestException si l'upload échoue", async () => {
      repository.findMe.mockResolvedValue(ME_DATA);
      cloudinary.upload.mockRejectedValue(new Error('Cloudinary error'));

      await expect(service.updateAvatar('user-1', MOCK_FILE)).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.updateAvatar).not.toHaveBeenCalled();
    });
  });

  describe('updateLocation', () => {
    it('met à jour les coordonnées GPS', async () => {
      const locationResult = {
        id: 'user-1',
        latitude: 14.6937,
        longitude: -17.4441,
      };
      repository.updateLocation.mockResolvedValue(locationResult);

      const result = await service.updateLocation('user-1', {
        latitude: 14.6937,
        longitude: -17.4441,
      });

      expect(repository.updateLocation).toHaveBeenCalledWith(
        'user-1',
        14.6937,
        -17.4441,
      );
      expect(result).toEqual(locationResult);
    });
  });

  describe('updateAvailability', () => {
    it('met à jour la disponibilité pour un donneur', async () => {
      repository.updateAvailability.mockResolvedValue({
        id: 'user-1',
        isAvailable: false,
      });

      const result = await service.updateAvailability(
        'user-1',
        { isAvailable: false },
        Role.DONOR,
      );

      expect(repository.updateAvailability).toHaveBeenCalledWith(
        'user-1',
        false,
      );
      expect(result).toEqual({ id: 'user-1', isAvailable: false });
    });

    it('lève ForbiddenException pour un non-donneur', async () => {
      await expect(
        service.updateAvailability(
          'user-1',
          { isAvailable: false },
          Role.ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.updateAvailability).not.toHaveBeenCalled();
    });
  });

  describe('updateExpoToken', () => {
    it('met à jour le token Expo', async () => {
      const tokenResult = {
        id: 'user-1',
        expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      };
      repository.updateExpoToken.mockResolvedValue(tokenResult);

      const result = await service.updateExpoToken('user-1', {
        expoPushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      });

      expect(repository.updateExpoToken).toHaveBeenCalledWith(
        'user-1',
        'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      );
      expect(result).toEqual(tokenResult);
    });
  });

  describe('deleteMe', () => {
    it("anonymise le compte d'un donneur", async () => {
      repository.softDelete.mockResolvedValue({ id: 'user-1' });

      const result = await service.deleteMe('user-1', Role.DONOR);

      expect(repository.softDelete).toHaveBeenCalledWith('user-1');
      expect(result.message).toBeDefined();
    });

    it("anonymise le compte d'un agent hospitalier", async () => {
      repository.softDelete.mockResolvedValue({ id: 'user-1' });

      const result = await service.deleteMe('user-1', Role.HOSPITAL_AGENT);

      expect(repository.softDelete).toHaveBeenCalledWith('user-1');
      expect(result.message).toBeDefined();
    });

    it('lève ForbiddenException pour un admin', async () => {
      await expect(service.deleteMe('user-1', Role.ADMIN)).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });
});

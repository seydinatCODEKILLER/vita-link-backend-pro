import { Test, TestingModule } from '@nestjs/testing';
import { BadgesRepository } from './badges.repository';
import { PrismaService } from '@/prisma/prisma.service';

const createMockPrismaService = () => ({
  badge: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
});

describe('BadgesRepository', () => {
  let repository: BadgesRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgesRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(BadgesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllForAdmin', () => {
    it('appelle badge.findMany avec le select admin et tri par createdAt desc', async () => {
      const fakeBadges = [
        {
          id: 'badge-1',
          name: 'Premier Pas',
          description: 'Premier don effectué',
          iconUrl: null,
          criteria: '{"minDonations":1}',
          isSeasonal: false,
          season: null,
          isActive: true,
          createdAt: new Date('2026-01-01'),
        },
      ];
      prisma.badge.findMany.mockResolvedValue(fakeBadges);

      const result = await repository.findAllForAdmin();

      expect(prisma.badge.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          description: true,
          iconUrl: true,
          criteria: true,
          isSeasonal: true,
          season: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(fakeBadges);
    });
  });

  describe('findBadgeById', () => {
    it('retourne le badge trouvé avec le select admin complet', async () => {
      const fakeBadge = {
        id: 'badge-1',
        name: 'Guerrier',
        description: '5 dons effectués',
        iconUrl: null,
        criteria: '{"minDonations":5}',
        isSeasonal: false,
        season: null,
        isActive: true,
        createdAt: new Date('2026-01-01'),
      };
      prisma.badge.findUnique.mockResolvedValue(fakeBadge);

      const result = await repository.findBadgeById('badge-1');

      expect(prisma.badge.findUnique).toHaveBeenCalledWith({
        where: { id: 'badge-1' },
        select: expect.objectContaining({ id: true, name: true }),
      });
      expect(result).toEqual(fakeBadge);
    });

    it('retourne null si le badge est introuvable', async () => {
      prisma.badge.findUnique.mockResolvedValue(null);

      const result = await repository.findBadgeById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('createBadge', () => {
    it('crée le badge avec les données fournies et le select admin', async () => {
      const input = {
        name: 'Sang Précieux',
        description: 'Donneur O- ou AB-',
        criteria: '{"bloodType":"O_NEG"}',
      };
      const created = {
        id: 'badge-2',
        ...input,
        iconUrl: null,
        isSeasonal: false,
        season: null,
        isActive: true,
        createdAt: new Date('2026-06-01'),
      };
      prisma.badge.create.mockResolvedValue(created);

      const result = await repository.createBadge(input);

      expect(prisma.badge.create).toHaveBeenCalledWith({
        data: input,
        select: expect.objectContaining({ id: true, criteria: true }),
      });
      expect(result).toEqual(created);
    });
  });

  describe('updateBadge', () => {
    it("ne transmet que les champs fournis dans l'objet data", async () => {
      const updated = {
        id: 'badge-1',
        name: 'Vétéran',
        description: '10 dons effectués',
        iconUrl: null,
        criteria: '{"minDonations":10}',
        isSeasonal: false,
        season: null,
        isActive: true,
        createdAt: new Date('2026-01-01'),
      };
      prisma.badge.update.mockResolvedValue(updated);

      const result = await repository.updateBadge('badge-1', {
        name: 'Vétéran',
      });

      expect(prisma.badge.update).toHaveBeenCalledWith({
        where: { id: 'badge-1' },
        data: { name: 'Vétéran' },
        select: expect.objectContaining({ id: true }),
      });
      expect(result).toEqual(updated);
    });
  });

  describe('softDelete', () => {
    it('met isActive à false et retourne le select de statut réduit', async () => {
      const statusResult = { id: 'badge-1', name: 'Guerrier', isActive: false };
      prisma.badge.update.mockResolvedValue(statusResult);

      const result = await repository.softDelete('badge-1');

      expect(prisma.badge.update).toHaveBeenCalledWith({
        where: { id: 'badge-1' },
        data: { isActive: false },
        select: { id: true, name: true, isActive: true },
      });
      expect(result).toEqual(statusResult);
    });
  });

  describe('reactivate', () => {
    it('met isActive à true et retourne le select de statut réduit', async () => {
      const statusResult = { id: 'badge-1', name: 'Guerrier', isActive: true };
      prisma.badge.update.mockResolvedValue(statusResult);

      const result = await repository.reactivate('badge-1');

      expect(prisma.badge.update).toHaveBeenCalledWith({
        where: { id: 'badge-1' },
        data: { isActive: true },
        select: { id: true, name: true, isActive: true },
      });
      expect(result).toEqual(statusResult);
    });
  });
});

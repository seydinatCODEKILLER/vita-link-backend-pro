import { Test, TestingModule } from '@nestjs/testing';
import { AdminRepository } from './admin.repository';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Role,
  BloodType,
  AlertStatus,
  BloodStockLevel,
  HealthStructureStatus,
  StructureType,
} from '@/generated/prisma/enums';

const createMockPrismaService = () => ({
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  healthStructure: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  donation: {
    count: jest.fn(),
  },
  alert: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  bloodStock: {
    groupBy: jest.fn(),
    upsert: jest.fn(),
  },
  jambaarsProfile: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
});

describe('AdminRepository', () => {
  let repository: AdminRepository;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get(AdminRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardKpis', () => {
    const setupResolvedValues = (
      overrides: Partial<Record<string, any>> = {},
    ) => {
      prisma.user.count.mockResolvedValue(overrides.totalDonors ?? 4500);
      prisma.healthStructure.count
        .mockResolvedValueOnce(overrides.totalStructures ?? 32)
        .mockResolvedValueOnce(overrides.pendingStructures ?? 5);
      prisma.donation.count.mockResolvedValue(overrides.totalDonations ?? 1200);
      prisma.alert.count.mockResolvedValue(overrides.totalAlerts ?? 890);
      prisma.$queryRaw.mockResolvedValue(
        overrides.avgResponseTimeRows ?? [{ avg_minutes: '14.5' }],
      );
      prisma.bloodStock.groupBy.mockResolvedValue(
        overrides.criticalStocks ?? [
          { healthStructureId: 's1', _count: { healthStructureId: 1 } },
          { healthStructureId: 's2', _count: { healthStructureId: 1 } },
        ],
      );
      prisma.jambaarsProfile.aggregate.mockResolvedValue(
        overrides.livesSaved ?? { _sum: { livesSavedEstimate: 1800 } },
      );
    };

    it('agrège tous les KPIs correctement', async () => {
      setupResolvedValues();

      const result = await repository.getDashboardKpis();

      expect(result).toEqual({
        totalDonors: 4500,
        totalStructures: 32,
        totalDonations: 1200,
        totalAlerts: 890,
        avgResponseTimeMinutes: 14.5,
        criticalStocksCount: 2,
        livesSavedEstimate: 1800,
        pendingStructures: 5,
      });
    });

    it('appelle user.count avec le filtre role DONOR et isActive true', async () => {
      setupResolvedValues();

      await repository.getDashboardKpis();

      expect(prisma.user.count).toHaveBeenCalledWith({
        where: { role: Role.DONOR, isActive: true },
      });
    });

    it('appelle healthStructure.count avec VERIFIED puis PENDING_REVIEW', async () => {
      setupResolvedValues();

      await repository.getDashboardKpis();

      expect(prisma.healthStructure.count).toHaveBeenNthCalledWith(1, {
        where: { status: HealthStructureStatus.VERIFIED },
      });
      expect(prisma.healthStructure.count).toHaveBeenNthCalledWith(2, {
        where: { status: HealthStructureStatus.PENDING_REVIEW },
      });
    });

    it('retourne avgResponseTimeMinutes: null si aucune donnée disponible', async () => {
      setupResolvedValues({ avgResponseTimeRows: [{ avg_minutes: null }] });

      const result = await repository.getDashboardKpis();

      expect(result.avgResponseTimeMinutes).toBeNull();
    });

    it('retourne avgResponseTimeMinutes: null si le tableau est vide', async () => {
      setupResolvedValues({ avgResponseTimeRows: [] });

      const result = await repository.getDashboardKpis();

      expect(result.avgResponseTimeMinutes).toBeNull();
    });

    it('convertit avg_minutes (string) en nombre', async () => {
      setupResolvedValues({ avgResponseTimeRows: [{ avg_minutes: '22.3' }] });

      const result = await repository.getDashboardKpis();

      expect(result.avgResponseTimeMinutes).toBe(22.3);
    });

    it('retourne criticalStocksCount = 0 si aucun groupe critique', async () => {
      setupResolvedValues({ criticalStocks: [] });

      const result = await repository.getDashboardKpis();

      expect(result.criticalStocksCount).toBe(0);
    });

    it('retourne livesSavedEstimate = 0 si _sum.livesSavedEstimate est null', async () => {
      setupResolvedValues({
        livesSaved: { _sum: { livesSavedEstimate: null } },
      });

      const result = await repository.getDashboardKpis();

      expect(result.livesSavedEstimate).toBe(0);
    });
  });

  describe('findUsers', () => {
    const USERS = [{ id: 'donor-1', firstName: 'Awa', lastName: 'Diop' }];

    it('retourne les utilisateurs paginés sans filtre', async () => {
      prisma.user.findMany.mockResolvedValue(USERS);
      prisma.user.count.mockResolvedValue(1);

      const result = await repository.findUsers({ page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.user.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ data: USERS, total: 1 });
    });

    it('applique le filtre role quand fourni', async () => {
      prisma.user.findMany.mockResolvedValue(USERS);
      prisma.user.count.mockResolvedValue(1);

      await repository.findUsers({ role: Role.DONOR, page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: Role.DONOR } }),
      );
    });

    it('applique le filtre bloodType quand fourni', async () => {
      prisma.user.findMany.mockResolvedValue(USERS);
      prisma.user.count.mockResolvedValue(1);

      await repository.findUsers({
        bloodType: BloodType.O_NEG,
        page: 1,
        limit: 20,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bloodType: BloodType.O_NEG } }),
      );
    });

    it('applique le filtre isActive même si false', async () => {
      prisma.user.findMany.mockResolvedValue(USERS);
      prisma.user.count.mockResolvedValue(1);

      await repository.findUsers({ isActive: false, page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('applique le filtre city via jambaarsProfile.city insensible à la casse', async () => {
      prisma.user.findMany.mockResolvedValue(USERS);
      prisma.user.count.mockResolvedValue(1);

      await repository.findUsers({ city: 'dakar', page: 1, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            jambaarsProfile: {
              city: { contains: 'dakar', mode: 'insensitive' },
            },
          },
        }),
      );
    });

    it('calcule correctement skip pour la page 3', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await repository.findUsers({ page: 3, limit: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });

  describe('findUserById', () => {
    it("retourne l'utilisateur avec le détail complet", async () => {
      const detail = { id: 'user-1', firstName: 'Awa' };
      prisma.user.findUnique.mockResolvedValue(detail);

      const result = await repository.findUserById('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          id: true,
          employerStructure: expect.any(Object),
          _count: expect.any(Object),
        }),
      });
      expect(result).toEqual(detail);
    });

    it('retourne null si introuvable', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findUserById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('suspendUser', () => {
    it("met isActive à false, révoque les tokens et crée un log d'audit", async () => {
      const updatedUser = {
        id: 'user-1',
        firstName: 'Awa',
        lastName: 'Diop',
        role: Role.DONOR,
      };
      const txUserUpdate = jest.fn().mockResolvedValue(updatedUser);
      const txAuditCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          user: { update: txUserUpdate },
          auditLog: { create: txAuditCreate },
        }),
      );

      const result = await repository.suspendUser(
        'user-1',
        'admin-1',
        'Trop de no-shows',
      );

      expect(txUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          isActive: false,
          refreshToken: null,
          refreshTokenExpiresAt: null,
        },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      expect(txAuditCreate).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          action: 'USER_SUSPENDED',
          entityType: 'USER',
          entityId: 'user-1',
          details: JSON.stringify({ reason: 'Trop de no-shows' }),
        },
      });
      expect(result).toEqual(updatedUser);
    });

    it('crée un log avec details: null si aucune raison fournie', async () => {
      const txUserUpdate = jest.fn().mockResolvedValue({});
      const txAuditCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          user: { update: txUserUpdate },
          auditLog: { create: txAuditCreate },
        }),
      );

      await repository.suspendUser('user-1', 'admin-1', undefined);

      expect(txAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ details: null }),
        }),
      );
    });
  });

  describe('reactivateUser', () => {
    it("remet isActive à true et crée un log d'audit", async () => {
      const updatedUser = {
        id: 'user-1',
        firstName: 'Awa',
        lastName: 'Diop',
        role: Role.DONOR,
      };
      const txUserUpdate = jest.fn().mockResolvedValue(updatedUser);
      const txAuditCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          user: { update: txUserUpdate },
          auditLog: { create: txAuditCreate },
        }),
      );

      const result = await repository.reactivateUser('user-1', 'admin-1');

      expect(txUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
      });
      expect(txAuditCreate).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          action: 'USER_REACTIVATED',
          entityType: 'USER',
          entityId: 'user-1',
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('findStructures', () => {
    const STRUCTURES = [{ id: 'structure-1', name: 'CNTS de Dakar' }];

    it('retourne les structures paginées sans filtre', async () => {
      prisma.healthStructure.findMany.mockResolvedValue(STRUCTURES);
      prisma.healthStructure.count.mockResolvedValue(1);

      const result = await repository.findStructures({ page: 1, limit: 20 });

      expect(prisma.healthStructure.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({ data: STRUCTURES, total: 1 });
    });

    it('applique les filtres status, structureType et region simultanément', async () => {
      prisma.healthStructure.findMany.mockResolvedValue(STRUCTURES);
      prisma.healthStructure.count.mockResolvedValue(1);

      await repository.findStructures({
        status: HealthStructureStatus.VERIFIED,
        structureType: StructureType.CNTS,
        region: 'Dakar',
        page: 1,
        limit: 20,
      });

      expect(prisma.healthStructure.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: HealthStructureStatus.VERIFIED,
            structureType: StructureType.CNTS,
            region: 'Dakar',
          },
        }),
      );
    });
  });

  describe('verifyStructure', () => {
    it("passe la structure à VERIFIED avec verifiedAt et crée un log d'audit", async () => {
      const updatedStructure = {
        id: 'structure-1',
        name: 'CNTS de Dakar',
        status: HealthStructureStatus.VERIFIED,
        verifiedAt: new Date('2026-06-29'),
      };
      const txUpdate = jest.fn().mockResolvedValue(updatedStructure);
      const txAuditCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          healthStructure: { update: txUpdate },
          auditLog: { create: txAuditCreate },
        }),
      );

      const result = await repository.verifyStructure('structure-1', 'admin-1');

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        data: {
          isVerified: true,
          status: HealthStructureStatus.VERIFIED,
          verifiedAt: expect.any(Date),
        },
        select: { id: true, name: true, status: true, verifiedAt: true },
      });
      expect(txAuditCreate).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          action: 'STRUCTURE_VERIFIED',
          entityType: 'HEALTH_STRUCTURE',
          entityId: 'structure-1',
        },
      });
      expect(result).toEqual(updatedStructure);
    });
  });

  describe('suspendStructure', () => {
    it('passe la structure à SUSPENDED et isVerified à false', async () => {
      const updatedStructure = {
        id: 'structure-1',
        name: 'Hôpital X',
        status: HealthStructureStatus.SUSPENDED,
      };
      const txUpdate = jest.fn().mockResolvedValue(updatedStructure);
      const txAuditCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          healthStructure: { update: txUpdate },
          auditLog: { create: txAuditCreate },
        }),
      );

      const result = await repository.suspendStructure(
        'structure-1',
        'admin-1',
        'Agrément périmé',
      );

      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        data: { status: HealthStructureStatus.SUSPENDED, isVerified: false },
        select: { id: true, name: true, status: true },
      });
      expect(txAuditCreate).toHaveBeenCalledWith({
        data: {
          userId: 'admin-1',
          action: 'STRUCTURE_SUSPENDED',
          entityType: 'HEALTH_STRUCTURE',
          entityId: 'structure-1',
          details: JSON.stringify({ reason: 'Agrément périmé' }),
        },
      });
      expect(result).toEqual(updatedStructure);
    });

    it('crée un log avec details: null si aucune raison fournie', async () => {
      const txUpdate = jest.fn().mockResolvedValue({});
      const txAuditCreate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          healthStructure: { update: txUpdate },
          auditLog: { create: txAuditCreate },
        }),
      );

      await repository.suspendStructure('structure-1', 'admin-1', undefined);

      expect(txAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ details: null }),
        }),
      );
    });
  });

  describe('findAuditLogs', () => {
    const LOGS = [{ id: 'log-1', action: 'USER_SUSPENDED' }];

    it('retourne les logs paginés sans filtre', async () => {
      prisma.auditLog.findMany.mockResolvedValue(LOGS);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await repository.findAuditLogs({ page: 1, limit: 50 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({ data: LOGS, total: 1 });
    });

    it('applique le filtre action en mode insensible à la casse', async () => {
      prisma.auditLog.findMany.mockResolvedValue(LOGS);
      prisma.auditLog.count.mockResolvedValue(1);

      await repository.findAuditLogs({
        action: 'suspend',
        page: 1,
        limit: 50,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: { contains: 'suspend', mode: 'insensitive' } },
        }),
      );
    });

    it('applique simultanément entityType, entityId et userId', async () => {
      prisma.auditLog.findMany.mockResolvedValue(LOGS);
      prisma.auditLog.count.mockResolvedValue(1);

      await repository.findAuditLogs({
        entityType: 'USER',
        entityId: 'user-1',
        userId: 'admin-1',
        page: 1,
        limit: 50,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityType: 'USER',
            entityId: 'user-1',
            userId: 'admin-1',
          },
        }),
      );
    });
  });

  describe('findStructureById', () => {
    it('retourne le sous-ensemble de champs attendu', async () => {
      const structure = {
        id: 'structure-1',
        name: 'Hôpital X',
        structureType: StructureType.HOSPITAL,
        affiliatedCntsId: 'cnts-1',
        status: HealthStructureStatus.PENDING_REVIEW,
      };
      prisma.healthStructure.findUnique.mockResolvedValue(structure);

      const result = await repository.findStructureById('structure-1');

      expect(prisma.healthStructure.findUnique).toHaveBeenCalledWith({
        where: { id: 'structure-1' },
        select: {
          id: true,
          name: true,
          structureType: true,
          affiliatedCntsId: true,
          status: true,
        },
      });
      expect(result).toEqual(structure);
    });

    it('retourne null si introuvable', async () => {
      prisma.healthStructure.findUnique.mockResolvedValue(null);

      const result = await repository.findStructureById('inexistant');

      expect(result).toBeNull();
    });
  });

  describe('getRecentAlerts', () => {
    it('transforme les alertes avec structureName, region et bloodGroup formaté', async () => {
      prisma.alert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          status: AlertStatus.ACTIVE,
          bloodType: BloodType.O_NEG,
          createdAt: new Date('2026-06-25T10:00:00'),
          healthStructure: { name: 'Hôpital Principal', region: 'Dakar' },
        },
      ]);

      const result = await repository.getRecentAlerts(10);

      expect(prisma.alert.findMany).toHaveBeenCalledWith({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          id: true,
          healthStructure: expect.any(Object),
        }),
      });
      expect(result).toEqual([
        {
          id: 'alert-1',
          structureName: 'Hôpital Principal',
          region: 'Dakar',
          bloodGroup: 'ONEG',
          status: AlertStatus.ACTIVE,
          createdAt: new Date('2026-06-25T10:00:00'),
        },
      ]);
    });

    it("utilise 'Non spécifiée' si la région de la structure est null", async () => {
      prisma.alert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          status: AlertStatus.ACTIVE,
          bloodType: BloodType.A_POS,
          createdAt: new Date(),
          healthStructure: { name: 'Centre X', region: null },
        },
      ]);

      const result = await repository.getRecentAlerts(10);

      expect(result[0].region).toBe('Non spécifiée');
    });

    it('utilise la limite par défaut de 10 si non précisée', async () => {
      prisma.alert.findMany.mockResolvedValue([]);

      await repository.getRecentAlerts();

      expect(prisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('getMonthlyStats', () => {
    it('retourne 12 mois avec les valeurs fusionnées depuis les 3 requêtes raw', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ month: 'Jan', donations: 120 }])
        .mockResolvedValueOnce([{ month: 'Jan', alerts: 80 }])
        .mockResolvedValueOnce([{ month: 'Jan', livesSaved: 360 }]);

      const result = await repository.getMonthlyStats(2026);

      expect(result).toHaveLength(12);
      expect(result[0]).toEqual({
        month: 'Jan',
        donations: 120,
        alerts: 80,
        livesSaved: 360,
      });
    });

    it('retourne 0 pour les mois sans données', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ month: 'Jan', donations: 120 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repository.getMonthlyStats(2026);

      const fev = result.find((m) => m.month === 'Fév');
      expect(fev).toEqual({
        month: 'Fév',
        donations: 0,
        alerts: 0,
        livesSaved: 0,
      });
    });

    it('localise correctement les noms de mois (Fév, Avr, Aoû, Déc)', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await repository.getMonthlyStats(2026);

      expect(result.map((m) => m.month)).toEqual([
        'Jan',
        'Fév',
        'Mar',
        'Avr',
        'Mai',
        'Juin',
        'Juil',
        'Aoû',
        'Sep',
        'Oct',
        'Nov',
        'Déc',
      ]);
    });

    it('convertit livesSaved en nombre', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ month: 'Mar', livesSaved: '99' as any }]);

      const result = await repository.getMonthlyStats(2026);

      const mar = result.find((m) => m.month === 'Mar');
      expect(mar?.livesSaved).toBe(99);
    });
  });

  describe('getRegionStats', () => {
    it('retourne les donneurs sans demande si aucune alerte existe', async () => {
      prisma.jambaarsProfile.groupBy.mockResolvedValue([
        { city: 'Dakar', _count: { city: 45 } },
        { city: 'Thiès', _count: { city: 12 } },
      ]);
      prisma.alert.groupBy.mockResolvedValue([]);

      const result = await repository.getRegionStats();

      expect(prisma.healthStructure.findMany).not.toHaveBeenCalled();
      expect(result).toEqual([
        { region: 'Dakar', demandLevel: 0, donorsCount: 45 },
        { region: 'Thiès', demandLevel: 0, donorsCount: 12 },
      ]);
    });

    it("utilise 'Non spécifiée' si city est null (cas sans alerte)", async () => {
      prisma.jambaarsProfile.groupBy.mockResolvedValue([
        { city: null, _count: { city: 3 } },
      ]);
      prisma.alert.groupBy.mockResolvedValue([]);

      const result = await repository.getRegionStats();

      expect(result).toEqual([
        { region: 'Non spécifiée', demandLevel: 0, donorsCount: 3 },
      ]);
    });

    it('calcule le demandLevel normalisé sur 100 et trie par demande décroissante', async () => {
      prisma.jambaarsProfile.groupBy.mockResolvedValue([
        { city: 'Dakar', _count: { city: 45 } },
        { city: 'Thiès', _count: { city: 12 } },
      ]);
      prisma.alert.groupBy.mockResolvedValue([
        { healthStructureId: 'structure-1', _count: { id: 80 } },
        { healthStructureId: 'structure-2', _count: { id: 40 } },
      ]);
      prisma.healthStructure.findMany.mockResolvedValue([
        { id: 'structure-1', region: 'Dakar' },
        { id: 'structure-2', region: 'Thiès' },
      ]);

      const result = await repository.getRegionStats();

      expect(result[0]).toEqual({
        region: 'Dakar',
        demandLevel: 100,
        donorsCount: 45,
      });
      expect(result[1]).toEqual({
        region: 'Thiès',
        demandLevel: 50,
        donorsCount: 12,
      });
    });

    it('ignore les structures sans région assignée', async () => {
      prisma.jambaarsProfile.groupBy.mockResolvedValue([]);
      prisma.alert.groupBy.mockResolvedValue([
        { healthStructureId: 'structure-1', _count: { id: 10 } },
      ]);
      prisma.healthStructure.findMany.mockResolvedValue([
        { id: 'structure-1', region: null },
      ]);

      const result = await repository.getRegionStats();

      expect(result).toEqual([]);
    });

    it('inclut une région présente uniquement dans les alertes (pas de donneur)', async () => {
      prisma.jambaarsProfile.groupBy.mockResolvedValue([]);
      prisma.alert.groupBy.mockResolvedValue([
        { healthStructureId: 'structure-1', _count: { id: 10 } },
      ]);
      prisma.healthStructure.findMany.mockResolvedValue([
        { id: 'structure-1', region: 'Ziguinchor' },
      ]);

      const result = await repository.getRegionStats();

      expect(result).toEqual([
        { region: 'Ziguinchor', demandLevel: 100, donorsCount: 0 },
      ]);
    });
  });

  describe('ensureStockInitialized', () => {
    it('exécute un upsert pour chacun des 8 groupes sanguins', async () => {
      prisma.bloodStock.upsert.mockResolvedValue({});

      await repository.ensureStockInitialized('cnts-1');

      expect(prisma.bloodStock.upsert).toHaveBeenCalledTimes(8);
      expect(prisma.bloodStock.upsert).toHaveBeenCalledWith({
        where: {
          healthStructureId_bloodType: {
            healthStructureId: 'cnts-1',
            bloodType: BloodType.O_NEG,
          },
        },
        create: {
          healthStructureId: 'cnts-1',
          bloodType: BloodType.O_NEG,
          quantity: 0,
          level: BloodStockLevel.ADEQUATE,
        },
        update: {},
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { BloodStocksService } from './blood-stocks.service';
import { BloodStocksRepository } from './blood-stocks.repository';
import { EventsService } from '@/events/events.service';
import {
  BloodStockLevel,
  BloodType,
  HealthStructureStatus,
  Role,
  StructureType,
} from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { UpdateStockDto } from './dto/update-stock.dto';

const createMockRepository = () => ({
  findByStructure: jest.fn(),
  findAllWithStructure: jest.fn(),
  upsertStock: jest.fn(),
  findByCntsAndType: jest.fn(),
  decrement: jest.fn(),
});

const createMockEventsService = () => ({
  emitToStructure: jest.fn(),
  emitToAdmins: jest.fn(),
});

const STOCK = {
  id: 'stock-1',
  bloodType: BloodType.O_NEG,
  quantity: 10,
  level: BloodStockLevel.ADEQUATE,
  updatedAt: new Date('2026-06-25'),
};

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'agent-1',
  firstName: 'Awa',
  lastName: 'Diop',
  email: 'awa@cnts.sn',
  role: Role.CNTS_AGENT,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'cnts-1',
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
  employerStructure: {
    id: 'cnts-1',
    name: 'CNTS de Dakar',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Route de Rufisque',
    latitude: null,
    longitude: null,
    structureType: StructureType.CNTS,
    affiliatedCntsId: null,
  },
  ...overrides,
});

const CNTS_AGENT = makeUser();

const HOSPITAL_AGENT = makeUser({
  id: 'hospital-agent-1',
  role: Role.HOSPITAL_AGENT,
  healthStructureId: 'hospital-1',
  employerStructure: {
    id: 'hospital-1',
    name: 'Hôpital Principal',
    status: HealthStructureStatus.VERIFIED,
    isVerified: true,
    address: 'Avenue Nelson Mandela',
    latitude: null,
    longitude: null,
    structureType: StructureType.HOSPITAL,
    affiliatedCntsId: 'cnts-1',
  },
});

const USER_NO_STRUCTURE = makeUser({
  healthStructureId: null,
  employerStructure: null,
});

const UPDATE_DTO: UpdateStockDto = {
  bloodType: BloodType.O_NEG,
  quantity: 10,
};

describe('BloodStocksService', () => {
  let service: BloodStocksService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodStocksService,
        { provide: BloodStocksRepository, useValue: repository },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(BloodStocksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyStocks', () => {
    it('retourne les stocks de la structure', async () => {
      repository.findByStructure.mockResolvedValue([STOCK]);

      const result = await service.getMyStocks(CNTS_AGENT);

      expect(repository.findByStructure).toHaveBeenCalledWith('cnts-1');
      expect(result).toEqual([STOCK]);
    });

    it("lève ForbiddenException si l'utilisateur n'a pas de structure", async () => {
      await expect(service.getMyStocks(USER_NO_STRUCTURE)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateMyStock', () => {
    beforeEach(() => {
      repository.upsertStock.mockResolvedValue(STOCK);
    });

    it('met à jour le stock et émet stock:updated', async () => {
      const result = await service.updateMyStock(CNTS_AGENT, UPDATE_DTO);

      expect(repository.upsertStock).toHaveBeenCalledWith(
        'cnts-1',
        BloodType.O_NEG,
        10,
        BloodStockLevel.ADEQUATE,
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        'cnts-1',
        'stock:updated',
        expect.objectContaining({ bloodType: BloodType.O_NEG, quantity: 10 }),
      );
      expect(result).toEqual(STOCK);
    });

    it('calcule le niveau CRITICAL pour quantity = 0', async () => {
      repository.upsertStock.mockResolvedValue({
        ...STOCK,
        quantity: 0,
        level: BloodStockLevel.CRITICAL,
      });

      await service.updateMyStock(CNTS_AGENT, {
        bloodType: BloodType.O_NEG,
        quantity: 0,
      });

      expect(repository.upsertStock).toHaveBeenCalledWith(
        'cnts-1',
        BloodType.O_NEG,
        0,
        BloodStockLevel.CRITICAL,
      );
    });

    it('calcule le niveau LOW pour quantity entre 1 et 5', async () => {
      await service.updateMyStock(CNTS_AGENT, {
        bloodType: BloodType.O_NEG,
        quantity: 3,
      });

      expect(repository.upsertStock).toHaveBeenCalledWith(
        'cnts-1',
        BloodType.O_NEG,
        3,
        BloodStockLevel.LOW,
      );
    });

    it('calcule le niveau SURPLUS pour quantity > 15', async () => {
      await service.updateMyStock(CNTS_AGENT, {
        bloodType: BloodType.O_NEG,
        quantity: 20,
      });

      expect(repository.upsertStock).toHaveBeenCalledWith(
        'cnts-1',
        BloodType.O_NEG,
        20,
        BloodStockLevel.SURPLUS,
      );
    });

    it('émet stock:critical aux admins si niveau CRITICAL', async () => {
      repository.upsertStock.mockResolvedValue({
        ...STOCK,
        quantity: 0,
        level: BloodStockLevel.CRITICAL,
      });

      await service.updateMyStock(CNTS_AGENT, {
        bloodType: BloodType.O_NEG,
        quantity: 0,
      });

      expect(events.emitToAdmins).toHaveBeenCalledWith(
        'stock:critical',
        expect.objectContaining({
          structureId: 'cnts-1',
          bloodType: BloodType.O_NEG,
          quantity: 0,
        }),
      );
    });

    it("n'émet pas stock:critical si niveau non critique", async () => {
      await service.updateMyStock(CNTS_AGENT, UPDATE_DTO);

      expect(events.emitToAdmins).not.toHaveBeenCalled();
    });

    it("lève ForbiddenException si l'utilisateur n'a pas de structure", async () => {
      await expect(
        service.updateMyStock(USER_NO_STRUCTURE, UPDATE_DTO),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève ForbiddenException si l'utilisateur n'est pas CNTS", async () => {
      await expect(
        service.updateMyStock(HOSPITAL_AGENT, UPDATE_DTO),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAllStocks', () => {
    it('retourne les stocks paginés avec les valeurs par défaut', async () => {
      repository.findAllWithStructure.mockResolvedValue({
        data: [STOCK],
        total: 1,
      });

      const result = await service.getAllStocks({});

      expect(repository.findAllWithStructure).toHaveBeenCalledWith({
        level: undefined,
        page: 1,
        limit: 50,
      });
      expect(result.stocks).toEqual([STOCK]);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('filtre par level si fourni', async () => {
      repository.findAllWithStructure.mockResolvedValue({ data: [], total: 0 });

      await service.getAllStocks({ level: BloodStockLevel.CRITICAL });

      expect(repository.findAllWithStructure).toHaveBeenCalledWith(
        expect.objectContaining({ level: BloodStockLevel.CRITICAL }),
      );
    });

    it('calcule correctement totalPages', async () => {
      repository.findAllWithStructure.mockResolvedValue({
        data: [],
        total: 120,
      });

      const result = await service.getAllStocks({ page: 1, limit: 50 });

      expect(result.pagination.totalPages).toBe(3);
    });
  });
});

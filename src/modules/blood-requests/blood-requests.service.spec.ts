import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BloodRequestsService } from './blood-requests.service';
import { BloodRequestsRepository } from './blood-requests.repository';
import { EventsService } from '@/events/events.service';
import {
  BloodRequestStatus,
  BloodType,
  HealthStructureStatus,
  Role,
  StructureType,
  UrgencyLevel,
} from '@/generated/prisma/enums';
import { AuthenticatedUser } from '@/common/types/request-with-user.type';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { HandleBloodRequestDto } from './dto/handle-blood-request.dto';

const createMockRepository = () => ({
  createRequest: jest.fn(),
  findRequestById: jest.fn(),
  findHospitalStructureById: jest.fn(),
  findStockByCntsAndType: jest.fn(),
  decrementStock: jest.fn(),
  findByHospital: jest.fn(),
  findByCnts: jest.fn(),
  updateStatus: jest.fn(),
});

const createMockEventsService = () => ({
  emitToStructure: jest.fn(),
});

const createMockEventEmitter = () => ({
  emitAsync: jest.fn().mockResolvedValue([]),
});

const BLOOD_REQUEST = {
  id: 'request-1',
  bloodType: BloodType.O_NEG,
  quantityNeeded: 3,
  quantityProvided: null,
  urgencyLevel: 'VITAL',
  serviceUnit: 'EMERGENCY_ROOM',
  clinicalContext: null,
  status: BloodRequestStatus.PENDING,
  cntsNotes: null,
  escalatedAlertId: null,
  fulfilledAt: null,
  createdAt: new Date('2026-06-25'),
  updatedAt: new Date('2026-06-25'),
  requestingHospital: {
    id: 'hospital-1',
    name: 'Hôpital Principal',
    address: 'Avenue Nelson Mandela',
    region: 'Dakar',
  },
  requestedBy: { id: 'user-1', firstName: 'Moussa', lastName: 'Fall' },
  handledByCnts: { id: 'cnts-1', name: 'CNTS de Dakar', region: 'Dakar' },
  handledBy: null,
  escalatedAlert: null,
  purchaseOrder: null,
};

const HOSPITAL_STRUCTURE = {
  id: 'hospital-1',
  name: 'Hôpital Principal',
  structureType: StructureType.HOSPITAL,
  affiliatedCntsId: 'cnts-1',
  isVerified: true,
  address: 'Avenue Nelson Mandela',
  latitude: 14.6937,
  longitude: -17.4441,
};

const STOCK = {
  id: 'stock-1',
  healthStructureId: 'cnts-1',
  bloodType: BloodType.O_NEG,
  quantity: 10,
  level: 'ADEQUATE',
  updatedAt: new Date(),
};

const makeUser = (
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: 'agent-1',
  firstName: 'Moussa',
  lastName: 'Fall',
  email: 'moussa@hopital.sn',
  role: Role.HOSPITAL_AGENT,
  isActive: true,
  bloodType: null,
  avatarUrl: null,
  healthStructureId: 'hospital-1',
  isStructureAdmin: false,
  latitude: null,
  longitude: null,
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
  ...overrides,
});

const HOSPITAL_AGENT = makeUser();

const CNTS_AGENT = makeUser({
  id: 'cnts-agent-1',
  role: Role.CNTS_AGENT,
  healthStructureId: 'cnts-1',
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
});

const ADMIN_USER = makeUser({
  id: 'admin-1',
  role: Role.ADMIN,
  healthStructureId: null,
  employerStructure: null,
});

const CREATE_DTO: CreateBloodRequestDto = {
  bloodType: BloodType.O_NEG,
  quantityNeeded: 3,
  urgencyLevel: UrgencyLevel.VITAL,
};

describe('BloodRequestsService', () => {
  let service: BloodRequestsService;
  let repository: ReturnType<typeof createMockRepository>;
  let events: ReturnType<typeof createMockEventsService>;
  let emitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(async () => {
    repository = createMockRepository();
    events = createMockEventsService();
    emitter = createMockEventEmitter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BloodRequestsService,
        { provide: BloodRequestsRepository, useValue: repository },
        { provide: EventsService, useValue: events },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    service = module.get(BloodRequestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    beforeEach(() => {
      repository.findHospitalStructureById.mockResolvedValue(
        HOSPITAL_STRUCTURE,
      );
      repository.createRequest.mockResolvedValue(BLOOD_REQUEST);
    });

    it('crée la demande et notifie la CNTS affiliée', async () => {
      const result = await service.createRequest(CREATE_DTO, HOSPITAL_AGENT);

      expect(repository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestingHospitalId: 'hospital-1',
          handledByCntsId: 'cnts-1',
          bloodType: BloodType.O_NEG,
        }),
      );
      expect(events.emitToStructure).toHaveBeenCalledWith(
        'cnts-1',
        'blood_request:new',
        expect.objectContaining({ requestId: 'request-1' }),
      );
      expect(result).toEqual(BLOOD_REQUEST);
    });

    it('lève NotFoundException si la structure est introuvable', async () => {
      repository.findHospitalStructureById.mockResolvedValue(null);

      await expect(
        service.createRequest(CREATE_DTO, HOSPITAL_AGENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève ForbiddenException si la structure est une CNTS', async () => {
      repository.findHospitalStructureById.mockResolvedValue({
        ...HOSPITAL_STRUCTURE,
        structureType: StructureType.CNTS,
      });

      await expect(
        service.createRequest(CREATE_DTO, CNTS_AGENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève BadRequestException si l'hôpital n'est pas affilié à une CNTS", async () => {
      repository.findHospitalStructureById.mockResolvedValue({
        ...HOSPITAL_STRUCTURE,
        affiliatedCntsId: null,
      });

      await expect(
        service.createRequest(CREATE_DTO, HOSPITAL_AGENT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleRequest', () => {
    beforeEach(() => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);
      repository.findStockByCntsAndType.mockResolvedValue(STOCK);
      repository.decrementStock.mockResolvedValue({});
      repository.updateStatus.mockResolvedValue({
        ...BLOOD_REQUEST,
        status: BloodRequestStatus.FULFILLED,
      });
    });

    describe('FULFILL', () => {
      const dto: HandleBloodRequestDto = { action: 'FULFILL', radiusKm: 10 };

      it('traite la demande en totalité et émet blood_request:fulfilled', async () => {
        repository.findRequestById
          .mockResolvedValueOnce(BLOOD_REQUEST)
          .mockResolvedValueOnce({
            ...BLOOD_REQUEST,
            status: BloodRequestStatus.FULFILLED,
          });

        const result = await service.handleRequest(
          'request-1',
          dto,
          CNTS_AGENT,
        );

        expect(repository.decrementStock).toHaveBeenCalledWith('stock-1', 3);
        expect(emitter.emitAsync).toHaveBeenCalledWith(
          'blood_request.fulfilled',
          expect.objectContaining({ requestId: 'request-1' }),
        );
        expect(events.emitToStructure).toHaveBeenCalledWith(
          'hospital-1',
          'blood_request:fulfilled',
          expect.objectContaining({ requestId: 'request-1' }),
        );
        expect(result?.status).toBe(BloodRequestStatus.FULFILLED);
      });

      it('lève BadRequestException si le stock est insuffisant', async () => {
        repository.findStockByCntsAndType.mockResolvedValue({
          ...STOCK,
          quantity: 1,
        });

        await expect(
          service.handleRequest('request-1', dto, CNTS_AGENT),
        ).rejects.toThrow(BadRequestException);
      });

      it('lève BadRequestException si aucun stock', async () => {
        repository.findStockByCntsAndType.mockResolvedValue(null);

        await expect(
          service.handleRequest('request-1', dto, CNTS_AGENT),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('PARTIALLY_FULFILL', () => {
      const dto: HandleBloodRequestDto = {
        action: 'PARTIALLY_FULFILL',
        quantityProvided: 1,
        radiusKm: 10,
      };

      it('traite partiellement et émet blood_request:partial', async () => {
        repository.findRequestById
          .mockResolvedValueOnce(BLOOD_REQUEST)
          .mockResolvedValueOnce({
            ...BLOOD_REQUEST,
            status: BloodRequestStatus.PARTIALLY_FULFILLED,
            quantityProvided: 1,
          });

        const result = await service.handleRequest(
          'request-1',
          dto,
          CNTS_AGENT,
        );

        expect(repository.decrementStock).toHaveBeenCalledWith('stock-1', 1);
        expect(emitter.emitAsync).toHaveBeenCalledWith(
          'blood_request.handled',
          expect.objectContaining({
            action: 'PARTIALLY_FULFILL',
            requestId: 'request-1',
          }),
        );
        expect(events.emitToStructure).toHaveBeenCalledWith(
          'hospital-1',
          'blood_request:partial',
          expect.objectContaining({ quantityProvided: 1 }),
        );
        expect(result?.status).toBe(BloodRequestStatus.PARTIALLY_FULFILLED);
      });

      it('lève BadRequestException si le stock est insuffisant', async () => {
        repository.findStockByCntsAndType.mockResolvedValue({
          ...STOCK,
          quantity: 0,
        });

        await expect(
          service.handleRequest('request-1', dto, CNTS_AGENT),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('ESCALATE', () => {
      const dto: HandleBloodRequestDto = {
        action: 'ESCALATE',
        radiusKm: 10,
      };

      it('escalade la demande et émet blood_request:escalated', async () => {
        repository.findRequestById
          .mockResolvedValueOnce(BLOOD_REQUEST)
          .mockResolvedValueOnce({
            ...BLOOD_REQUEST,
            status: BloodRequestStatus.ESCALATED_TO_ALERT,
          });

        const result = await service.handleRequest(
          'request-1',
          dto,
          CNTS_AGENT,
        );

        expect(emitter.emitAsync).toHaveBeenCalledWith(
          'blood_request.handled',
          expect.objectContaining({
            action: 'ESCALATE',
            requestId: 'request-1',
          }),
        );
        expect(events.emitToStructure).toHaveBeenCalledWith(
          'hospital-1',
          'blood_request:escalated',
          expect.objectContaining({ requestId: 'request-1' }),
        );
        expect(result?.status).toBe(BloodRequestStatus.ESCALATED_TO_ALERT);
      });
    });

    describe('REJECT', () => {
      const dto: HandleBloodRequestDto = {
        action: 'REJECT',
        cntsNotes: 'Non éligible',
      };

      it('rejette la demande et émet blood_request:rejected', async () => {
        repository.updateStatus.mockResolvedValue({
          ...BLOOD_REQUEST,
          status: BloodRequestStatus.REJECTED,
          cntsNotes: 'Non éligible',
        });

        const result = await service.handleRequest(
          'request-1',
          dto,
          CNTS_AGENT,
        );

        expect(repository.updateStatus).toHaveBeenCalledWith(
          'request-1',
          expect.objectContaining({ status: BloodRequestStatus.REJECTED }),
        );
        expect(events.emitToStructure).toHaveBeenCalledWith(
          'hospital-1',
          'blood_request:rejected',
          expect.objectContaining({ requestId: 'request-1' }),
        );
        expect(result?.status).toBe(BloodRequestStatus.REJECTED);
      });
    });

    it('lève NotFoundException si la demande est introuvable', async () => {
      repository.findRequestById.mockResolvedValue(null);

      await expect(
        service.handleRequest('inexistant', { action: 'REJECT' }, CNTS_AGENT),
      ).rejects.toThrow(NotFoundException);
    });

    it("lève ForbiddenException si la demande n'est pas adressée à la CNTS", async () => {
      const otherCnts = makeUser({
        healthStructureId: 'autre-cnts',
        employerStructure: {
          ...CNTS_AGENT.employerStructure!,
          id: 'autre-cnts',
        },
      });

      await expect(
        service.handleRequest('request-1', { action: 'REJECT' }, otherCnts),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève BadRequestException si la demande n'est pas PENDING", async () => {
      repository.findRequestById.mockResolvedValue({
        ...BLOOD_REQUEST,
        status: BloodRequestStatus.FULFILLED,
      });

      await expect(
        service.handleRequest('request-1', { action: 'REJECT' }, CNTS_AGENT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRequests', () => {
    it('appelle findByCnts pour un agent CNTS', async () => {
      repository.findByCnts.mockResolvedValue({
        data: [BLOOD_REQUEST],
        total: 1,
      });

      const result = await service.getRequests(CNTS_AGENT, {});

      expect(repository.findByCnts).toHaveBeenCalledWith('cnts-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(result.requests).toEqual([BLOOD_REQUEST]);
      expect(result.pagination.total).toBe(1);
    });

    it('appelle findByHospital pour un agent hospitalier', async () => {
      repository.findByHospital.mockResolvedValue({
        data: [BLOOD_REQUEST],
        total: 1,
      });

      const result = await service.getRequests(HOSPITAL_AGENT, {});

      expect(repository.findByHospital).toHaveBeenCalledWith('hospital-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(result.requests).toEqual([BLOOD_REQUEST]);
    });

    it('calcule correctement totalPages', async () => {
      repository.findByCnts.mockResolvedValue({ data: [], total: 45 });

      const result = await service.getRequests(CNTS_AGENT, {
        page: 1,
        limit: 20,
      });

      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe('getById', () => {
    it("retourne la demande pour l'hôpital demandeur", async () => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);

      const result = await service.getById('request-1', HOSPITAL_AGENT);

      expect(result).toEqual(BLOOD_REQUEST);
    });

    it('retourne la demande pour la CNTS assignée', async () => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);

      const result = await service.getById('request-1', CNTS_AGENT);

      expect(result).toEqual(BLOOD_REQUEST);
    });

    it('retourne la demande pour un admin', async () => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);

      const result = await service.getById('request-1', ADMIN_USER);

      expect(result).toEqual(BLOOD_REQUEST);
    });

    it('lève ForbiddenException pour une autre structure', async () => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);

      const otherUser = makeUser({ healthStructureId: 'autre-structure' });

      await expect(service.getById('request-1', otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lève NotFoundException si la demande est introuvable', async () => {
      repository.findRequestById.mockResolvedValue(null);

      await expect(
        service.getById('inexistant', HOSPITAL_AGENT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelRequest', () => {
    it('annule la demande PENDING', async () => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);
      repository.updateStatus.mockResolvedValue({
        ...BLOOD_REQUEST,
        status: BloodRequestStatus.CANCELLED,
      });

      const result = await service.cancelRequest('request-1', HOSPITAL_AGENT);

      expect(repository.updateStatus).toHaveBeenCalledWith('request-1', {
        status: BloodRequestStatus.CANCELLED,
      });
      expect(result.status).toBe(BloodRequestStatus.CANCELLED);
    });

    it("lève ForbiddenException si ce n'est pas l'hôpital demandeur", async () => {
      repository.findRequestById.mockResolvedValue(BLOOD_REQUEST);

      await expect(
        service.cancelRequest('request-1', CNTS_AGENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève BadRequestException si la demande n'est pas PENDING", async () => {
      repository.findRequestById.mockResolvedValue({
        ...BLOOD_REQUEST,
        status: BloodRequestStatus.FULFILLED,
      });

      await expect(
        service.cancelRequest('request-1', HOSPITAL_AGENT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève NotFoundException si la demande est introuvable', async () => {
      repository.findRequestById.mockResolvedValue(null);

      await expect(
        service.cancelRequest('inexistant', HOSPITAL_AGENT),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

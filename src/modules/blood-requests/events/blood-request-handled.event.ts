import { BloodType, UrgencyLevel, ServiceUnit } from '@/generated/prisma/enums';

export type BloodRequestAction =
  | 'FULFILL'
  | 'PARTIALLY_FULFILL'
  | 'ESCALATE'
  | 'REJECT';

export class BloodRequestHandledEvent {
  constructor(
    public readonly action: BloodRequestAction,
    public readonly requestId: string,
    public readonly cntsId: string,
    public readonly hospitalId: string,
    public readonly bloodType: BloodType,
    public readonly urgencyLevel: UrgencyLevel,
    public readonly serviceUnit: ServiceUnit,
    public readonly quantityNeeded: number,
    public readonly quantityProvided: number,
    public readonly radiusKm: number,
    public readonly agentUser: any,
  ) {}
}

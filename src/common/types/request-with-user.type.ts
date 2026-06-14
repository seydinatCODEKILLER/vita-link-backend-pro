import { Request } from 'express';
import { Role } from '../enums/roles.enum';
import {
  BloodType,
  HealthStructureStatus,
  StructureType,
} from '@/generated/prisma/enums';

export interface AuthenticatedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  bloodType: BloodType;
  avatarUrl: string | null;
  healthStructureId: string | null;
  isStructureAdmin: boolean;
  employerStructure: {
    id: string;
    name: string;
    status: HealthStructureStatus;
    isVerified: boolean;
    address: string;
    latitude: number | null;
    longitude: number | null;
    structureType: StructureType;
    affiliatedCntsId: string | null;
  } | null;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

import { Role } from '../enums/roles.enum';

export interface JwtPayload {
  id: string;
  role: Role;
  iat?: number;
  exp?: number;
}

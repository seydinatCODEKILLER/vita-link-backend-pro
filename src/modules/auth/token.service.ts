import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { JwtPayload } from '@/common/types/jwt-payload.type';
import { SignOptions } from 'jsonwebtoken';
import { Role } from '@/generated/prisma/enums';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {}

  buildPair(userId: string, role: Role) {
    const payload: JwtPayload = { id: userId, role };

    const accessToken = this.jwtService.sign(payload as object);
    const refreshToken = this.jwtService.sign(payload as object, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>(
        'JWT_REFRESH_DURATION',
      ) as SignOptions['expiresIn'],
    });

    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    return { accessToken, refreshToken, expiresAt };
  }

  async issueAndStore(user: { id: string; role: Role }) {
    const { accessToken, refreshToken, expiresAt } = this.buildPair(
      user.id,
      user.role,
    );
    await this.authRepository.storeRefreshToken(
      user.id,
      refreshToken,
      expiresAt,
    );
    return { accessToken, refreshToken };
  }

  async rotate(oldRefreshToken: string) {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(oldRefreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    const user = await this.authRepository.findByRefreshToken(oldRefreshToken);
    if (!user) {
      throw new UnauthorizedException(
        'Session invalide. Veuillez vous reconnecter.',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Compte suspendu.');
    }

    return this.issueAndStore({ id: decoded.id, role: decoded.role });
  }

  async revoke(userId: string): Promise<void> {
    await this.authRepository.revokeRefreshToken(userId);
  }
}

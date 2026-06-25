import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtPayload } from '@/common/types/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        bloodType: true,
        avatarUrl: true,
        latitude: true,
        longitude: true,
        healthStructureId: true,
        isStructureAdmin: true,
        employerStructure: {
          select: {
            id: true,
            name: true,
            status: true,
            isVerified: true,
            address: true,
            latitude: true,
            longitude: true,
            structureType: true,
            affiliatedCntsId: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Token appartient à un utilisateur qui n'existe plus",
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Compte suspendu');
    }

    return user;
  }
}

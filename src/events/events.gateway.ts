import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { EventsService } from './events.service';
import { Role } from '@/generated/prisma/enums';

interface SocketWithUser extends Socket {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    role: Role;
    healthStructureId: string | null;
  };
}

const HEALTH_ROLES: Role[] = [
  Role.CNTS_AGENT,
  Role.CNTS_ADMIN,
  Role.HOSPITAL_AGENT,
];
const ALERT_ROLES: Role[] = [...HEALTH_ROLES, Role.ADMIN];

@WebSocketGateway({
  cors: { origin: '*', credentials: false, methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  afterInit(server: Server): void {
    this.eventsService.setServer(server);
    this.logger.log('Socket.io initialisé');

    server.use((socket, next) => {
      const socketWithUser = socket as SocketWithUser;

      const handleAuth = async () => {
        try {
          const token =
            socketWithUser.handshake.auth?.token ||
            socketWithUser.handshake.headers?.authorization?.split(' ')[1];

          if (!token) return next(new Error('TOKEN_MISSING'));

          const decoded = this.jwtService.verify<{ id: string }>(token, {
            secret: this.config.getOrThrow<string>('JWT_SECRET'),
          });

          const user = await this.prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
              healthStructureId: true,
            },
          });

          if (!user) return next(new Error('USER_NOT_FOUND'));
          if (!user.isActive) return next(new Error('ACCOUNT_SUSPENDED'));

          socketWithUser.user = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            healthStructureId: user.healthStructureId,
          };

          next();
        } catch {
          next(new Error('TOKEN_INVALID'));
        }
      };

      void handleAuth();
    });
  }

  handleConnection(socket: SocketWithUser): void {
    const { id, firstName, lastName, role, healthStructureId } = socket.user;
    const fullName = `${firstName} ${lastName}`;

    this.logger.log(`🔌 ${fullName} connecté — ${socket.id}`);

    void socket.join(`user:${id}`);

    if (role === Role.DONOR) void socket.join('donors');

    if (HEALTH_ROLES.includes(role) && healthStructureId) {
      void socket.join(`structure:${healthStructureId}`);
    }

    if (role === Role.ADMIN) void socket.join('admins');
  }

  handleDisconnect(socket: SocketWithUser): void {
    const { id, firstName, lastName } = socket.user ?? {};
    this.logger.log(
      `🔌 ${firstName} ${lastName} déconnecté — ${socket.id} — userId: ${id}`,
    );
  }

  @SubscribeMessage('join:alert')
  handleJoinAlert(
    @ConnectedSocket() socket: SocketWithUser,
    @MessageBody() payload: { alertId: string },
  ): void {
    if (!payload?.alertId) return;
    if (!ALERT_ROLES.includes(socket.user.role)) return;

    void socket.join(`alert:${payload.alertId}`);
    this.logger.log(
      `${socket.user.firstName} a rejoint alert:${payload.alertId}`,
    );
  }

  @SubscribeMessage('leave:alert')
  handleLeaveAlert(
    @ConnectedSocket() socket: SocketWithUser,
    @MessageBody() payload: { alertId: string },
  ): void {
    if (!payload?.alertId) return;
    void socket.leave(`alert:${payload.alertId}`);
  }
}

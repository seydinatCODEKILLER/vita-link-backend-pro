import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class EventsService {
  private server!: Server;
  private readonly logger = new Logger(EventsService.name);

  setServer(server: Server): void {
    this.server = server;
    this.logger.log('Serveur Socket.io injecté dans EventsService');
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToDonors(event: string, data: unknown): void {
    this.server.to('donors').emit(event, data);
  }

  emitToAlert(alertId: string, event: string, data: unknown): void {
    this.server.to(`alert:${alertId}`).emit(event, data);
  }

  emitToStructure(structureId: string, event: string, data: unknown): void {
    this.server.to(`structure:${structureId}`).emit(event, data);
  }

  emitToAdmins(event: string, data: unknown): void {
    this.server.to('admins').emit(event, data);
  }

  emitToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}

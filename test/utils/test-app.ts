// test/utils/test-app.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { AuthEmailService } from '@/modules/auth/email.service';
import { EventsService } from '@/events/events.service';
import { PushService } from '@/modules/notifications/push.service';
import { PrismaService } from '@/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  emailServiceMock: { sendOtp: jest.Mock };
  eventsServiceMock: {
    emitToUser: jest.Mock;
    emitToDonors: jest.Mock;
    emitToAlert: jest.Mock;
    emitToStructure: jest.Mock;
    emitToAdmins: jest.Mock;
    emitToAll: jest.Mock;
  };
  pushServiceMock: { sendMulticast: jest.Mock };
}> {
  const emailServiceMock = { sendOtp: jest.fn().mockResolvedValue(undefined) };

  const eventsServiceMock = {
    setServer: jest.fn(),
    emitToUser: jest.fn(),
    emitToDonors: jest.fn(),
    emitToAlert: jest.fn(),
    emitToStructure: jest.fn(),
    emitToAdmins: jest.fn(),
    emitToAll: jest.fn(),
  };

  const pushServiceMock = {
    sendMulticast: jest.fn().mockResolvedValue(undefined),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AuthEmailService)
    .useValue(emailServiceMock)
    .overrideProvider(EventsService)
    .useValue(eventsServiceMock)
    .overrideProvider(PushService)
    .useValue(pushServiceMock)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma, emailServiceMock, eventsServiceMock, pushServiceMock };
}

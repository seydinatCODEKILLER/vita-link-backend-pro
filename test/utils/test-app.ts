// test/utils/test-app.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { AuthEmailService } from '@/modules/auth/email.service';
import { PrismaService } from '@/prisma/prisma.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  emailServiceMock: { sendOtp: jest.Mock };
}> {
  const emailServiceMock = { sendOtp: jest.fn().mockResolvedValue(undefined) };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AuthEmailService)
    .useValue(emailServiceMock)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma, emailServiceMock };
}

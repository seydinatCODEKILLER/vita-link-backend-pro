import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  isDev: process.env.NODE_ENV === 'development',
  logLevel:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  dummyHash:
    process.env.DUMMY_HASH ??
    '$2b$10$abcdefghijklmnopqrstuuVVmqJZOdEJ.JkpjBnBnNmS6RsOi8jCy',
  cors: {
    webUrl: process.env.WEB_URL ?? '',
    webUrlDev: process.env.WEB_URL_DEV ?? 'http://localhost:3001',
    webUrlDev2: process.env.WEB_URL_DEV_2 ?? 'http://localhost:3000',
    swaggerUrl: process.env.SWAGGER_URL ?? '',
  },
}));

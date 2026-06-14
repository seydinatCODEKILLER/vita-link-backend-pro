import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  duration: process.env.JWT_DURATION ?? '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshDuration: process.env.JWT_REFRESH_DURATION ?? '30d',
}));

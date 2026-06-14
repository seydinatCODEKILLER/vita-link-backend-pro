import { registerAs } from '@nestjs/config';

export const brevoConfig = registerAs('brevo', () => ({
  apiKey: process.env.BREVO_API_KEY,
  mailFrom: process.env.MAIL_FROM ?? 'noreply@vita-link.sn',
}));

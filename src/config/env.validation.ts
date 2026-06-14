import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  JWT_SECRET: Joi.string().required(),
  JWT_DURATION: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_DURATION: Joi.string().default('30d'),

  CLOUDINARY_CLOUD_NAME: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default(''),
  }),
  CLOUDINARY_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default(''),
  }),
  CLOUDINARY_API_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default(''),
  }),

  BREVO_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default(''),
  }),
  MAIL_FROM: Joi.string().email().default('noreply@vita-link.sn'),

  WEB_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default(''),
  }),
  WEB_URL_DEV: Joi.string().default('http://localhost:3001'),
  WEB_URL_DEV_2: Joi.string().default('http://localhost:3000'),
  SWAGGER_URL: Joi.string().optional(),

  DUMMY_HASH: Joi.string().default(
    '$2b$10$abcdefghijklmnopqrstuuVVmqJZOdEJ.JkpjBnBnNmS6RsOi8jCy',
  ),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .optional(),
});

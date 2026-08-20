import 'dotenv/config';
import 'dotenv/config';
import { z } from 'zod';

// .env files commonly leave unset optional values as an empty string rather
// than omitting the key entirely; treat "" the same as undefined.
const optionalString = () =>
  z.preprocess((value) => (value === '' ? undefined : value), z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ALLOWED_ORIGINS: z.string().default(''),

  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CREDENTIALS_MODE: z.enum(['adc', 'file', 'json']).default('adc'),
  GOOGLE_APPLICATION_CREDENTIALS: optionalString(),
  FIREBASE_SERVICE_ACCOUNT_JSON: optionalString(),
  FCM_ANDROID_CHANNEL_ID: z.string().min(1).default('default_channel'),

  JWT_ISSUER: z.string().min(1, 'JWT_ISSUER is required'),
  JWT_AUDIENCE: z.string().min(1, 'JWT_AUDIENCE is required'),
  JWT_JWKS_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  JWT_PUBLIC_KEY: optionalString(),
  NOTIFICATION_REQUIRED_ROLE: z.string().min(1).default('notification:send'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  MAX_JSON_BODY_SIZE: z.string().default('100kb'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  const env = parsed.data;

  if (env.FIREBASE_CREDENTIALS_MODE === 'file' && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is required when FIREBASE_CREDENTIALS_MODE=file',
    );
  }
  if (env.FIREBASE_CREDENTIALS_MODE === 'json' && !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is required when FIREBASE_CREDENTIALS_MODE=json',
    );
  }
  if (!env.JWT_JWKS_URL && !env.JWT_PUBLIC_KEY) {
    throw new Error('Either JWT_JWKS_URL or JWT_PUBLIC_KEY must be configured');
  }
  if (env.NODE_ENV === 'production' && !env.JWT_JWKS_URL) {
    throw new Error('JWT_JWKS_URL must be configured in production (JWKS-based verification)');
  }

  return env;
}

export const env = loadEnv();

export const corsAllowedOrigins: string[] = env.CORS_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

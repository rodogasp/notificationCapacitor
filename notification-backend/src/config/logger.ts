import pino from 'pino';
import { env } from './env';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  '*.token',
  '*.password',
  '*.privateKey',
  '*.private_key',
  '*.serviceAccount',
  '*.service_account',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: undefined,
});

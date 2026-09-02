import pino from 'pino';
import { env } from './env';
import { publishLog, type BackendLogRecord } from './log-bus';

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

const logStream = {
  write(line: string): void {
    try {
      publishLog(JSON.parse(line) as BackendLogRecord);
    } catch {
      // Pino writes one JSON record per line; ignore non-record output.
    }
  },
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: undefined,
}, pino.multistream([
  { stream: process.stdout },
  { stream: logStream },
]));

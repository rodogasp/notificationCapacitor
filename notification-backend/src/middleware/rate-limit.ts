import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../shared/errors';

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.rateLimited());
  },
});

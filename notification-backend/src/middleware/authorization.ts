import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../shared/errors';
import { env } from '../config/env';

/**
 * Requires the authenticated user to carry the configured
 * NOTIFICATION_REQUIRED_ROLE claim (role or scope). Intended for
 * internal/administrator-only endpoints such as notification sending.
 */
export function requireNotificationRole(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  if (!req.user.roles.includes(env.NOTIFICATION_REQUIRED_ROLE)) {
    next(AppError.forbidden('Missing required role for this operation'));
    return;
  }
  next();
}

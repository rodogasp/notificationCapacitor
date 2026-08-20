import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details: Array<{ path?: string; message: string }>;
    requestId: string;
  };
}

/**
 * Centralized error handler. Converts known error types into the standard
 * error envelope and ensures no internal details (stack traces, SQL, etc.)
 * leak to clients, especially in production.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (error instanceof AppError) {
    logger.warn(
      { requestId, code: error.code, statusCode: error.statusCode },
      'Handled application error',
    );
    const body: ErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
    };
    res.status(error.statusCode).json(body);
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    logger.warn({ requestId, details }, 'Request validation failed');
    const body: ErrorResponseBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
        requestId,
      },
    };
    res.status(400).json(body);
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ requestId, err: message }, 'Unhandled error');

  const body: ErrorResponseBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : message,
      details: [],
      requestId,
    },
  };
  res.status(500).json(body);
}

/**
 * Catches errors thrown by async route handlers/controllers and forwards
 * them to the centralized error handler.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

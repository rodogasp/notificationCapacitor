import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './config/logger';
import { env, corsAllowedOrigins } from './config/env';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limit';
import { AppError } from './shared/errors';
import { healthRouter } from './routes/health.routes';
import { deviceRouter } from './modules/devices/device.routes';
import { notificationRouter } from './modules/notifications/notification.routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: corsAllowedOrigins.length > 0 ? corsAllowedOrigins : false,
    }),
  );
  app.use(express.json({ limit: env.MAX_JSON_BODY_SIZE }));
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Never log Authorization headers or full request/response bodies.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(rateLimiter);

  app.use(healthRouter);
  app.use('/api/v1/devices', deviceRouter);
  app.use('/api/v1/notifications', notificationRouter);

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(AppError.notFound('Route not found'));
  });

  app.use(errorHandler);

  return app;
}

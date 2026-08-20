import type { Request, Response } from 'express';
import { Router } from 'express';
import { checkDatabaseReady } from '../config/database';
import { isFirebaseReady } from '../config/firebase';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const [databaseReady, firebaseReady] = [await checkDatabaseReady(), isFirebaseReady()];
  const ready = databaseReady && firebaseReady;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    checks: {
      database: databaseReady ? 'ok' : 'unavailable',
      firebase: firebaseReady ? 'ok' : 'unavailable',
    },
  });
});

import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initializeFirebase } from './config/firebase';
import { prisma, disconnectDatabase } from './config/database';

async function main(): Promise<void> {
  initializeFirebase();

  const app = createApp();
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'Notification backend listening');
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Received shutdown signal, closing gracefully');

    server.close(async (closeError) => {
      if (closeError) {
        logger.error({ err: closeError.message }, 'Error while closing HTTP server');
      }
      try {
        await disconnectDatabase();
      } catch (error) {
        logger.error(
          { err: error instanceof Error ? error.message : 'unknown' },
          'Error while disconnecting Prisma',
        );
      } finally {
        process.exit(closeError ? 1 : 0);
      }
    });

    // Safety net in case connections never drain.
    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', error);
  process.exit(1);
});

// Re-exported so it is not flagged as unused when only imported for its side effects elsewhere.
export { prisma };

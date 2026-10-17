import { app } from './app';
import { env } from './config/env';
import { sqlClient } from './db';

import { bootstrapAdmin } from './db/bootstrap';
import { upgradeSchema } from './db/upgrade';

const server = app.listen(env.PORT, '0.0.0.0', async () => {
  console.log(`==============================================`);
  console.log(` MeDa Partners Operating System - Backend`);
  console.log(` Environment: ${env.NODE_ENV}`);
  console.log(` Listening on: http://localhost:${env.PORT} (and http://0.0.0.0:${env.PORT})`);
  console.log(` Health check: http://localhost:${env.PORT}/health`);
  console.log(`==============================================`);

  try {
    await upgradeSchema();
  } catch {
    console.error('[Schema] Upgrade failed. The API may not work until it succeeds (run `npm run db:upgrade`).');
  }
  await bootstrapAdmin();
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await sqlClient.end();
      console.log('Database connections closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database teardown:', err);
      process.exit(1);
    }
  });

  // Force shutdown after timeout if pending connections do not drain
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

// Process safety handlers to prevent unhandled database rejections from crashing the server
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason);
  console.error('[Process] Caught unhandled rejection:', msg);
});

process.on('uncaughtException', (err: any) => {
  const msg = err?.message || String(err);
  console.error('[Process] Caught uncaught exception:', msg);
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


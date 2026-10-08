import { app } from './app';
import { env } from './config/env';
import { sqlClient } from './db';

const server = app.listen(env.PORT, () => {
  console.log(`==============================================`);
  console.log(` MeDa Partners Operating System - Backend`);
  console.log(` Environment: ${env.NODE_ENV}`);
  console.log(` Listening on: http://localhost:${env.PORT}`);
  console.log(` Health check: http://localhost:${env.PORT}/health`);
  console.log(`==============================================`);
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

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

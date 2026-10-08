import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { db, sqlClient } from './index';

export async function runMigrations() {
  console.log('Running database migrations...');
  try {
    const migrationsFolder = path.resolve(__dirname, 'migrations');
    await migrate(db, { migrationsFolder });
    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}

// If invoked directly from CLI
if (require.main === module || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      await sqlClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await sqlClient.end();
      process.exit(1);
    });
}

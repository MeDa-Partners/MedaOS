import { sqlClient } from './index';
import { bootstrapAdmin } from './bootstrap';

export async function seedDatabase() {
  console.log('Running MeDa OS initialization...');
  await bootstrapAdmin();
  console.log('Initialization completed.');
}

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await sqlClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Initialization error:', err);
      await sqlClient.end();
      process.exit(1);
    });
}

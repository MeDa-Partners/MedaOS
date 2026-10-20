import { sqlClient } from './index';
import { ORDERS_DDL } from './ddl/orders';

/**
 * Idempotent, non-destructive schema upgrades for databases created by `reset-and-migrate.ts`.
 *
 * Each step must be safe to run any number of times. Runs automatically on server start
 * (before the admin bootstrap) and can be run by hand with `npm run db:upgrade`.
 * When the fresh-install DDL in `reset-and-migrate.ts` changes, add the matching step here.
 */
const UPGRADE_STEPS: { name: string; sql: string }[] = [
  {
    name: 'user_memberships.team_id optional (department membership without a team)',
    sql: `
      ALTER TABLE "user_memberships" ALTER COLUMN "team_id" DROP NOT NULL;
      ALTER TABLE "user_memberships" DROP CONSTRAINT IF EXISTS "user_memberships_team_id_fkey";
      ALTER TABLE "user_memberships" DROP CONSTRAINT IF EXISTS "user_memberships_team_id_teams_id_fk";
      ALTER TABLE "user_memberships"
        ADD CONSTRAINT "user_memberships_team_id_fkey"
        FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL;
    `,
  },
  {
    name: 'sections.description',
    sql: `ALTER TABLE "sections" ADD COLUMN IF NOT EXISTS "description" text;`,
  },
  {
    name: 'orders, order_events, sync_state, venture_integrations, assignment_shifts, process_settings',
    sql: ORDERS_DDL,
  },
];

export async function upgradeSchema(): Promise<void> {
  for (const step of UPGRADE_STEPS) {
    try {
      await sqlClient.begin(async (tx) => {
        await tx.unsafe(step.sql);
      });
      console.log(`[Schema] ✓ ${step.name}`);
    } catch (error) {
      console.error(`[Schema] ✗ ${step.name}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

if (require.main === module || process.argv[1]?.endsWith('upgrade.ts')) {
  upgradeSchema()
    .then(async () => {
      await sqlClient.end();
      process.exit(0);
    })
    .catch(async () => {
      await sqlClient.end();
      process.exit(1);
    });
}

import { sqlClient } from './index';
import { bootstrapAdmin } from './bootstrap';

export async function resetAndMigrate() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL ERROR: Destructive database reset is strictly forbidden in production mode!');
  }

  const isTest = process.env.NODE_ENV === 'test';
  const isConfirmed =
    process.env.CONFIRM_DB_RESET === 'true' || process.env.ALLOW_DESTRUCTIVE_RESET === 'true';

  if (!isTest && !isConfirmed) {
    throw new Error(
      'SAFEGUARD REJECTED: Destructive database reset requires explicit confirmation. Set CONFIRM_DB_RESET=true or ALLOW_DESTRUCTIVE_RESET=true to proceed in development/testing.'
    );
  }

  console.log('--- Starting Database Reset & Clean Schema Migration ---');

  // 1. Drop old and obsolete tables in dependency order
  console.log('1. Dropping obsolete tables...');
  await sqlClient.unsafe(`
    DROP TABLE IF EXISTS "user_sections" CASCADE;
    DROP TABLE IF EXISTS "user_memberships" CASCADE;
    DROP TABLE IF EXISTS "user_ventures" CASCADE;
    DROP TABLE IF EXISTS "venture_sections" CASCADE;
    DROP TABLE IF EXISTS "system_sections" CASCADE;
    DROP TABLE IF EXISTS "sections" CASCADE;
    DROP TABLE IF EXISTS "teams" CASCADE;
    DROP TABLE IF EXISTS "departments" CASCADE;
    DROP TABLE IF EXISTS "ventures" CASCADE;
    DROP TABLE IF EXISTS "sessions" CASCADE;
    DROP TABLE IF EXISTS "users" CASCADE;
  `);

  // 2. Create clean tables according to finalized hierarchy
  console.log('2. Creating fresh schema tables...');

  // Users
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(150) NOT NULL,
      "email" varchar(255) NOT NULL UNIQUE,
      "password_hash" varchar(255) NOT NULL,
      "is_admin" boolean NOT NULL DEFAULT false,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
    CREATE INDEX IF NOT EXISTS "users_is_admin_idx" ON "users" ("is_admin");
    CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users" ("status");
  `);

  // Sessions
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token_hash" varchar(128) NOT NULL UNIQUE,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "last_used_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
    CREATE INDEX IF NOT EXISTS "sessions_token_hash_idx" ON "sessions" ("token_hash");
    CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");
  `);

  // Ventures (Parent: MeDa Partners)
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "ventures" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" varchar(100) NOT NULL,
      "slug" varchar(100) NOT NULL UNIQUE,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "ventures_slug_idx" ON "ventures" ("slug");
    CREATE INDEX IF NOT EXISTS "ventures_status_idx" ON "ventures" ("status");
  `);

  // Departments (Belongs to exactly one Venture)
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "departments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
      "name" varchar(100) NOT NULL,
      "slug" varchar(100) NOT NULL,
      "head_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "departments_venture_slug_unique" ON "departments" ("venture_id", "slug");
    CREATE INDEX IF NOT EXISTS "departments_venture_id_idx" ON "departments" ("venture_id");
    CREATE INDEX IF NOT EXISTS "departments_head_user_id_idx" ON "departments" ("head_user_id");
    CREATE INDEX IF NOT EXISTS "departments_status_idx" ON "departments" ("status");
  `);

  // Teams (Belongs to exactly one Department)
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "teams" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "department_id" uuid NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
      "name" varchar(100) NOT NULL,
      "slug" varchar(100) NOT NULL,
      "head_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "teams_department_id_slug_unique" ON "teams" ("department_id", "slug");
    CREATE INDEX IF NOT EXISTS "teams_department_id_idx" ON "teams" ("department_id");
    CREATE INDEX IF NOT EXISTS "teams_head_user_id_idx" ON "teams" ("head_user_id");
    CREATE INDEX IF NOT EXISTS "teams_status_idx" ON "teams" ("status");
  `);

  // Sections (Belongs to exactly one Department)
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "sections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "department_id" uuid NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
      "name" varchar(100) NOT NULL,
      "slug" varchar(100) NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "sections_department_id_slug_unique" ON "sections" ("department_id", "slug");
    CREATE INDEX IF NOT EXISTS "sections_department_id_idx" ON "sections" ("department_id");
    CREATE INDEX IF NOT EXISTS "sections_slug_idx" ON "sections" ("slug");
    CREATE INDEX IF NOT EXISTS "sections_status_idx" ON "sections" ("status");
  `);

  // User Memberships (User has exactly 1 Department per Venture, and at most 1 Team inside it)
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "user_memberships" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
      "department_id" uuid NOT NULL REFERENCES "departments"("id") ON DELETE CASCADE,
      "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_memberships_user_venture_unique" ON "user_memberships" ("user_id", "venture_id");
    CREATE INDEX IF NOT EXISTS "user_memberships_user_id_idx" ON "user_memberships" ("user_id");
    CREATE INDEX IF NOT EXISTS "user_memberships_venture_id_idx" ON "user_memberships" ("venture_id");
    CREATE INDEX IF NOT EXISTS "user_memberships_dept_id_idx" ON "user_memberships" ("department_id");
    CREATE INDEX IF NOT EXISTS "user_memberships_team_id_idx" ON "user_memberships" ("team_id");
  `);

  // User Sections (User assigned access to individual Sections)
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "user_sections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "section_id" uuid NOT NULL REFERENCES "sections"("id") ON DELETE CASCADE,
      "created_at" timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_sections_user_section_unique" ON "user_sections" ("user_id", "section_id");
    CREATE INDEX IF NOT EXISTS "user_sections_user_id_idx" ON "user_sections" ("user_id");
    CREATE INDEX IF NOT EXISTS "user_sections_section_id_idx" ON "user_sections" ("section_id");
  `);

  // 3. Bootstrap initial Global Administrator
  console.log('3. Bootstrapping initial Global Administrator...');
  await bootstrapAdmin();

  console.log('--- Database Reset & Migration Finished Successfully ---');
}

if (require.main === module || process.argv[1]?.includes('reset-and-migrate')) {
  resetAndMigrate()
    .then(async () => {
      await sqlClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Migration failed:', err);
      await sqlClient.end();
      process.exit(1);
    });
}

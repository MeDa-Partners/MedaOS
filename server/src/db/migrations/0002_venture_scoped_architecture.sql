-- Clean up old access model tables and associations
DROP TABLE IF EXISTS "user_sections" CASCADE;
DROP TABLE IF EXISTS "user_ventures" CASCADE;
TRUNCATE TABLE "teams" CASCADE;

-- Update users table: remove team_id, add is_admin
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_team_id_teams_id_fk";
DROP INDEX IF EXISTS "users_team_id_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "team_id";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "users_is_admin_idx" ON "users" USING btree ("is_admin");

-- Update teams table: remove is_admin, add venture_id
ALTER TABLE "teams" DROP COLUMN IF EXISTS "is_admin";
ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_slug_unique";
DROP INDEX IF EXISTS "teams_slug_unique";
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "venture_id" uuid NOT NULL REFERENCES "public"."ventures"("id") ON DELETE cascade;
CREATE UNIQUE INDEX IF NOT EXISTS "teams_venture_id_slug_unique" ON "teams" USING btree ("venture_id", "slug");
CREATE INDEX IF NOT EXISTS "teams_venture_id_idx" ON "teams" USING btree ("venture_id");

-- Create venture_sections table
CREATE TABLE IF NOT EXISTS "venture_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venture_id" uuid NOT NULL REFERENCES "public"."ventures"("id") ON DELETE cascade,
	"section_id" uuid NOT NULL REFERENCES "public"."system_sections"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "venture_sections_venture_id_section_id_unique" ON "venture_sections" USING btree ("venture_id", "section_id");
CREATE INDEX IF NOT EXISTS "venture_sections_venture_id_idx" ON "venture_sections" USING btree ("venture_id");
CREATE INDEX IF NOT EXISTS "venture_sections_section_id_idx" ON "venture_sections" USING btree ("section_id");

-- Recreate user_ventures table with venture-specific team assignment
CREATE TABLE IF NOT EXISTS "user_ventures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"venture_id" uuid NOT NULL REFERENCES "public"."ventures"("id") ON DELETE cascade,
	"team_id" uuid NOT NULL REFERENCES "public"."teams"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_ventures_user_id_venture_id_unique" ON "user_ventures" USING btree ("user_id", "venture_id");
CREATE INDEX IF NOT EXISTS "user_ventures_user_id_idx" ON "user_ventures" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_ventures_venture_id_idx" ON "user_ventures" USING btree ("venture_id");
CREATE INDEX IF NOT EXISTS "user_ventures_team_id_idx" ON "user_ventures" USING btree ("team_id");

-- Recreate user_sections table scoped to venture
CREATE TABLE IF NOT EXISTS "user_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"venture_id" uuid NOT NULL REFERENCES "public"."ventures"("id") ON DELETE cascade,
	"section_id" uuid NOT NULL REFERENCES "public"."system_sections"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_sections_user_venture_section_unique" ON "user_sections" USING btree ("user_id", "venture_id", "section_id");
CREATE INDEX IF NOT EXISTS "user_sections_user_venture_idx" ON "user_sections" USING btree ("user_id", "venture_id");
CREATE INDEX IF NOT EXISTS "user_sections_section_id_idx" ON "user_sections" USING btree ("section_id");

-- Clean up and configure system sections catalog
DELETE FROM "system_sections" WHERE "slug" IN ('admin', 'user-management');

-- Update orders route to /orders
UPDATE "system_sections" SET "route" = '/orders' WHERE "slug" = 'orders';

-- Insert Employees section
INSERT INTO "system_sections" ("name", "slug", "route", "status")
VALUES ('Employees', 'employees', '/employees', 'active')
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "route" = EXCLUDED."route";

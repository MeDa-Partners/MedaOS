/**
 * DDL for the order-processing tables (WayVeda COD verification and any later venture that
 * ingests Shopify orders). Every statement is idempotent, so the same SQL is used by the
 * fresh install (`reset-and-migrate.ts`) and by the upgrade of an existing DB (`upgrade.ts`).
 * Keep it in sync with the Drizzle schema files in `db/schema/`.
 */
export const ORDERS_DDL = `
  -- Shopify (and later other provider) credentials per venture. client_secret is stored encrypted.
  CREATE TABLE IF NOT EXISTS "venture_integrations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
    "provider" varchar(30) NOT NULL,
    "shop_domain" varchar(255) NOT NULL,
    "client_id" varchar(255) NOT NULL,
    "client_secret" text NOT NULL,
    "active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "venture_integrations_venture_provider_unique" ON "venture_integrations" ("venture_id", "provider");

  -- Sync cursor and health. last_synced_at only advances after a fully successful run.
  CREATE TABLE IF NOT EXISTS "sync_state" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
    "provider" varchar(30) NOT NULL,
    "last_synced_at" timestamptz,
    "last_run_at" timestamptz,
    "last_error" text,
    "orders_synced" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "sync_state_venture_provider_unique" ON "sync_state" ("venture_id", "provider");
  -- Run lease ("only one sync at a time"). A row lease rather than pg_advisory_lock because the
  -- Supabase transaction pooler (port 6543) may run lock and unlock on different connections.
  ALTER TABLE "sync_state" ADD COLUMN IF NOT EXISTS "locked_until" timestamptz;


  -- One row per COD order. Shopify-owned columns are refreshed by sync; team-owned columns
  -- (scan/call/portal fields, owners, planned/actual times) never are.
  CREATE TABLE IF NOT EXISTS "orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
    "shopify_order_id" bigint NOT NULL,
    "shopify_updated_at" timestamptz NOT NULL,
    "raw_payload" jsonb,
    "task_id" varchar(30),
    "task_seq" integer,
    "order_number" varchar(30) NOT NULL,
    "order_date" timestamptz NOT NULL,
    "customer_name" varchar(200),
    "phone" varchar(20),
    "address" text,
    "city" varchar(100),
    "state" varchar(100),
    "pincode" varchar(20),
    "products" text,
    "total_qty" integer NOT NULL DEFAULT 0,
    "total_amount" numeric(12, 2) NOT NULL DEFAULT 0,
    "payment_method" varchar(20) NOT NULL,
    "channel" varchar(50),
    "financial_status" varchar(30),
    "fulfillment_status" varchar(30),
    "stage" varchar(30) NOT NULL DEFAULT 'new',
    "scan_outcome" varchar(100),
    "scan_at" timestamptz,
    "final_response" varchar(50),
    "collected_amount" numeric(12, 2),
    "balance_amount" numeric(12, 2),
    "address_confirmed" boolean,
    "new_address" text,
    "screenshot_url" text,
    "crm_remarks" text,
    "portal_action" varchar(50),
    "portal_done" boolean NOT NULL DEFAULT false,
    "admin_remarks" text,
    "follow_up_required" boolean NOT NULL DEFAULT false,
    "follow_up_done" boolean NOT NULL DEFAULT false,
    "follow_up_notes" text,
    "verification_assignee" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "verification_planned_at" timestamptz,
    "verification_actual_at" timestamptz,
    "portal_assignee" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "portal_planned_at" timestamptz,
    "portal_actual_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
  -- Columns added after the first version of this table (no-ops on a fresh install).
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "task_seq" integer;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scan_at" timestamptz;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "verification_planned_at" timestamptz;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "verification_actual_at" timestamptz;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "portal_planned_at" timestamptz;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "portal_actual_at" timestamptz;
  -- Soft Refused follow-up (the sheet's Sales Team tab, now a filter).
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "follow_up_required" boolean NOT NULL DEFAULT false;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "follow_up_done" boolean NOT NULL DEFAULT false;
  ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "follow_up_notes" text;
  CREATE UNIQUE INDEX IF NOT EXISTS "orders_venture_shopify_order_unique" ON "orders" ("venture_id", "shopify_order_id");
  -- Task number behind task_id (TSK-001, TSK-002, … TSK-1000): counts up per venture, never resets.
  CREATE UNIQUE INDEX IF NOT EXISTS "orders_venture_task_seq_unique" ON "orders" ("venture_id", "task_seq");
  CREATE INDEX IF NOT EXISTS "orders_venture_stage_idx" ON "orders" ("venture_id", "stage");
  CREATE INDEX IF NOT EXISTS "orders_venture_order_date_idx" ON "orders" ("venture_id", "order_date");
  CREATE INDEX IF NOT EXISTS "orders_verification_assignee_idx" ON "orders" ("verification_assignee");
  CREATE INDEX IF NOT EXISTS "orders_portal_assignee_idx" ON "orders" ("portal_assignee");

  -- The timeline: one row per thing that happened to an order.
  CREATE TABLE IF NOT EXISTS "order_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "step" varchar(30) NOT NULL,
    "event" varchar(50) NOT NULL,
    "by_user" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "at" timestamptz NOT NULL DEFAULT now(),
    "note" text
  );
  -- First version kept planned/actual on events; v2 keeps them on orders. Move "actual_at" to "at".
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_events' AND column_name = 'actual_at') THEN
      ALTER TABLE "order_events" ADD COLUMN IF NOT EXISTS "at" timestamptz;
      UPDATE "order_events" SET "at" = coalesce("actual_at", "created_at") WHERE "at" IS NULL;
      ALTER TABLE "order_events" ALTER COLUMN "at" SET DEFAULT now(), ALTER COLUMN "at" SET NOT NULL;
      ALTER TABLE "order_events" DROP COLUMN "actual_at", DROP COLUMN IF EXISTS "planned_at", DROP COLUMN IF EXISTS "created_at";
    END IF;
  END $$;
  CREATE INDEX IF NOT EXISTS "order_events_order_id_idx" ON "order_events" ("order_id");
  CREATE INDEX IF NOT EXISTS "order_events_venture_id_idx" ON "order_events" ("venture_id");

  -- v2 has no leave system: leave is handled by editing shifts or reassigning orders.
  DROP TABLE IF EXISTS "user_availability";

  -- Who owns orders arriving in each time window, per step. Shifts of a step tile all 24 hours;
  -- a shift with start > end crosses midnight. Validated in shifts.service.ts.
  CREATE TABLE IF NOT EXISTS "assignment_shifts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "venture_id" uuid NOT NULL REFERENCES "ventures"("id") ON DELETE CASCADE,
    "step" varchar(30) NOT NULL,
    "name" varchar(100) NOT NULL,
    "start_time" time NOT NULL,
    "end_time" time NOT NULL,
    "assignee_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "sort_order" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS "assignment_shifts_venture_step_idx" ON "assignment_shifts" ("venture_id", "step");

  -- Office hours and deadlines, one row per venture (defaults seeded on first use).
  -- The first version stored one row per step; it was never used, so it is replaced.
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'process_settings' AND column_name = 'step') THEN
      DROP TABLE "process_settings";
    END IF;
  END $$;
  CREATE TABLE IF NOT EXISTS "process_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "venture_id" uuid NOT NULL UNIQUE REFERENCES "ventures"("id") ON DELETE CASCADE,
    "office_start" time NOT NULL DEFAULT '09:00',
    "office_end" time NOT NULL DEFAULT '18:00',
    "overnight_deadline" time NOT NULL DEFAULT '11:00',
    "verification_tat_minutes" integer NOT NULL DEFAULT 5,
    "portal_tat_minutes" integer NOT NULL DEFAULT 30,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
  );
`;

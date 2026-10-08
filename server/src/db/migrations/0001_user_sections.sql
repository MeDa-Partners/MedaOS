DROP TABLE IF EXISTS "team_sections" CASCADE;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_sections" ADD CONSTRAINT "user_sections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sections" ADD CONSTRAINT "user_sections_section_id_system_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."system_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_sections_user_id_section_id_unique" ON "user_sections" USING btree ("user_id","section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sections_user_id_idx" ON "user_sections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sections_section_id_idx" ON "user_sections" USING btree ("section_id");--> statement-breakpoint
INSERT INTO "system_sections" ("name", "slug", "route", "status")
VALUES ('User Management', 'user-management', '/admin', 'active')
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "route" = EXCLUDED."route";--> statement-breakpoint
INSERT INTO "system_sections" ("name", "slug", "route", "status")
VALUES ('Orders', 'orders', '/operations', 'active')
ON CONFLICT ("slug") DO NOTHING;

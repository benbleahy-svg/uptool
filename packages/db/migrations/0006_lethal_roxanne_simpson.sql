ALTER TABLE "orgs" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "default_hourly_rate_cents" integer DEFAULT 0 NOT NULL;
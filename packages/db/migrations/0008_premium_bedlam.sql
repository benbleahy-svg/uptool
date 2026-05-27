CREATE TYPE "public"."rfq_source" AS ENUM('email', 'manual', 'manual_forward');--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "forwarding_address" text;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "source" "rfq_source" DEFAULT 'manual' NOT NULL;
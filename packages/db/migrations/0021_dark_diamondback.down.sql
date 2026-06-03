-- Hand-written rollback for 0021_dark_diamondback.sql (drizzle-kit does not emit
-- down migrations). Drops everything that migration added, in reverse order.
-- DROP TABLE part_materials also drops its org_id/part_id FKs and all its indexes.
-- Dropping a column also drops its CHECK constraint and column comment.
-- Safe to run repeatedly (IF EXISTS).

DROP TABLE IF EXISTS "part_materials";--> statement-breakpoint

ALTER TABLE "rfqs" DROP COLUMN IF EXISTS "quote_lead_time_variants";--> statement-breakpoint
ALTER TABLE "rfqs" DROP COLUMN IF EXISTS "quote_bulk_discount_pct";--> statement-breakpoint
ALTER TABLE "rfqs" DROP COLUMN IF EXISTS "quote_bulk_markup_pct";--> statement-breakpoint

ALTER TABLE "parts" DROP COLUMN IF EXISTS "estimate_hydrated_at";--> statement-breakpoint

ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "user_touched";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "volume_discount_tiers";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "runtime_rate_cents";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "setup_rate_cents";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "markup_pct";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "unit_price_override_cents";

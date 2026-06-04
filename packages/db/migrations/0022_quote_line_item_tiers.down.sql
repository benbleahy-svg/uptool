-- Hand-written rollback for 0022_quote_line_item_tiers.sql (drizzle-kit is
-- forward-only). Drops the 3 added columns + 3 indexes and reverts the markup_pct
-- alter. quote_unit_price_cents was intentionally NOT touched by 0022, so there's
-- nothing to revert there. Dropping a column also drops its comment; the two reused
-- columns' comments are cleared explicitly. Safe to run repeatedly (IF EXISTS).

DROP INDEX IF EXISTS "idx_quote_line_items_part";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_quote_line_items_org";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_quote_line_items_quote_sort";--> statement-breakpoint

ALTER TABLE "quote_line_items" DROP COLUMN IF EXISTS "sort_order";--> statement-breakpoint
ALTER TABLE "quote_line_items" DROP COLUMN IF EXISTS "tier_label";--> statement-breakpoint
ALTER TABLE "quote_line_items" DROP COLUMN IF EXISTS "quote_total_cents";--> statement-breakpoint

-- Revert markup_pct to its pre-0022 shape (unbounded numeric, default '30').
ALTER TABLE "quote_line_items" ALTER COLUMN "markup_pct" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "quote_line_items" ALTER COLUMN "markup_pct" SET DEFAULT '30';--> statement-breakpoint

-- Clear the model-name comments added to the reused columns.
COMMENT ON COLUMN "quote_line_items"."cost_per_unit_cents" IS NULL;--> statement-breakpoint
COMMENT ON COLUMN "quote_line_items"."quote_unit_price_cents" IS NULL;

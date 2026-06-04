ALTER TABLE "quote_line_items" ALTER COLUMN "markup_pct" SET DATA TYPE numeric(6, 2);--> statement-breakpoint
ALTER TABLE "quote_line_items" ALTER COLUMN "markup_pct" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "quote_total_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "tier_label" text;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_quote_line_items_quote_sort" ON "quote_line_items" USING btree ("quote_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_quote_line_items_org" ON "quote_line_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_quote_line_items_part" ON "quote_line_items" USING btree ("part_id");--> statement-breakpoint
COMMENT ON COLUMN "quote_line_items"."cost_per_unit_cents" IS 'Model estimateUnitCents — SNAPSHOT of the estimate unit cost frozen at quote creation (not live-linked).';--> statement-breakpoint
COMMENT ON COLUMN "quote_line_items"."quote_unit_price_cents" IS 'Model quoteUnitCents — computed quote unit price; nullable until the services prompt writes it (PDF computes when null).';--> statement-breakpoint
COMMENT ON COLUMN "quote_line_items"."quote_total_cents" IS 'Stored line total = quote_unit_price_cents × quantity (service writes on save).';
CREATE TABLE "part_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"material_type" text NOT NULL,
	"fields" jsonb NOT NULL,
	"unit_price_override_cents" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "unit_price_override_cents" integer;--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "markup_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "setup_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "runtime_rate_cents" integer;--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "volume_discount_tiers" jsonb;--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "user_touched" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "estimate_hydrated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "quote_bulk_markup_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "quote_bulk_discount_pct" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "quote_lead_time_variants" jsonb;--> statement-breakpoint
ALTER TABLE "part_materials" ADD CONSTRAINT "part_materials_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_materials" ADD CONSTRAINT "part_materials_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_part_materials_org" ON "part_materials" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_part_materials_part" ON "part_materials" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "idx_part_materials_part_sort" ON "part_materials" USING btree ("part_id","sort_order");--> statement-breakpoint
ALTER TABLE "part_operations" ADD CONSTRAINT "part_operations_markup_pct_check" CHECK ("part_operations"."markup_pct" IS NULL OR ("part_operations"."markup_pct" >= 0 AND "part_operations"."markup_pct" <= 100));--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_quote_bulk_markup_pct_check" CHECK ("rfqs"."quote_bulk_markup_pct" IS NULL OR ("rfqs"."quote_bulk_markup_pct" >= 0 AND "rfqs"."quote_bulk_markup_pct" <= 100));--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_quote_bulk_discount_pct_check" CHECK ("rfqs"."quote_bulk_discount_pct" IS NULL OR ("rfqs"."quote_bulk_discount_pct" >= 0 AND "rfqs"."quote_bulk_discount_pct" <= 100));--> statement-breakpoint
COMMENT ON COLUMN "rfqs"."quote_bulk_markup_pct" IS 'RFQ-wide default; per-line overrides live in quote_line_items.markupPct.';
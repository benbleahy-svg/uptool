CREATE TABLE "org_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"density_g_cm3" numeric(6, 4) NOT NULL,
	"price_eur_per_kg" numeric(10, 4) DEFAULT '0' NOT NULL,
	"price_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_materials_org_id_name_unique" UNIQUE("org_id","name"),
	CONSTRAINT "org_materials_category_check" CHECK ("org_materials"."category" IN ('steel', 'aluminium', 'stainless', 'titanium', 'plastic', 'copper', 'other'))
);
--> statement-breakpoint
ALTER TABLE "part_materials" ADD COLUMN "material_id" uuid;--> statement-breakpoint
ALTER TABLE "part_operations" ADD COLUMN "cost_category" text DEFAULT 'inside' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_materials" ADD CONSTRAINT "org_materials_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_org_materials_org" ON "org_materials" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_materials_org_category" ON "org_materials" USING btree ("org_id","category");--> statement-breakpoint
ALTER TABLE "part_materials" ADD CONSTRAINT "part_materials_material_id_org_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."org_materials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_operations" ADD CONSTRAINT "part_operations_cost_category_check" CHECK ("part_operations"."cost_category" IN ('inside', 'outside', 'purchased'));--> statement-breakpoint
-- Seed DACH-standard default materials for every existing org.
-- Prices default to 0 — configure in Settings → Materialien.
-- Idempotent: ON CONFLICT (org_id, name) DO NOTHING. Keep this list in sync with
-- seedOrgMaterials() in src/seed-org-materials.ts (the runtime path for new orgs).
INSERT INTO "org_materials" ("org_id", "name", "category", "density_g_cm3", "is_default")
SELECT o."id", m."name", m."category", m."density", true
FROM "orgs" o
CROSS JOIN (VALUES
	('S235JR', 'steel', 7.8500),
	('S355J2', 'steel', 7.8500),
	('1.4301 (304 SS)', 'stainless', 7.9300),
	('1.4404 (316L SS)', 'stainless', 7.9800),
	('EN AW-6082 T6', 'aluminium', 2.7000),
	('EN AW-5754 H22', 'aluminium', 2.6700),
	('EN AW-7075 T6', 'aluminium', 2.8100),
	('CuZn37 (MS63)', 'copper', 8.4400),
	('PA6 (Nylon)', 'plastic', 1.1500),
	('POM-C', 'plastic', 1.4100)
) AS m("name", "category", "density")
ON CONFLICT ("org_id", "name") DO NOTHING;
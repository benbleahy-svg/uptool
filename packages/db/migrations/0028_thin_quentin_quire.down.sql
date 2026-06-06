-- Hand-written rollback for 0028_thin_quentin_quire.sql (drizzle-kit is
-- forward-only). Reverses all three additions: the cost_category column +
-- check on part_operations, the material_id FK + column on part_materials, and
-- the org_materials table (whose drop also removes the seeded DACH defaults,
-- its indexes, unique constraint, and category check). Order matters: the
-- part_materials FK must go before the referenced org_materials table is
-- dropped. Safe to run repeatedly (IF EXISTS).

ALTER TABLE "part_operations" DROP CONSTRAINT IF EXISTS "part_operations_cost_category_check";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "cost_category";--> statement-breakpoint
ALTER TABLE "part_materials" DROP CONSTRAINT IF EXISTS "part_materials_material_id_org_materials_id_fk";--> statement-breakpoint
ALTER TABLE "part_materials" DROP COLUMN IF EXISTS "material_id";--> statement-breakpoint
DROP TABLE IF EXISTS "org_materials";

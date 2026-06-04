-- Hand-written rollback for 0023_parts_hierarchy.sql (drizzle-kit is
-- forward-only). Drops the self-referential parent FK + index and the two
-- added columns. Dropping parent_part_id also drops its FK constraint, but we
-- drop the index first explicitly. Safe to run repeatedly (IF EXISTS).

DROP INDEX IF EXISTS "idx_parts_parent";--> statement-breakpoint
ALTER TABLE "parts" DROP CONSTRAINT IF EXISTS "parts_parent_part_id_parts_id_fk";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "assembly_quantity";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "parent_part_id";

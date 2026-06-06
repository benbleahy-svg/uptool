-- Hand-written rollback for 0031_wet_natasha_romanoff.sql (drizzle-kit is
-- forward-only). Drops the time_source column + check on part_operations. Safe to
-- run repeatedly (IF EXISTS).

ALTER TABLE "part_operations" DROP CONSTRAINT IF EXISTS "part_operations_time_source_check";--> statement-breakpoint
ALTER TABLE "part_operations" DROP COLUMN IF EXISTS "time_source";

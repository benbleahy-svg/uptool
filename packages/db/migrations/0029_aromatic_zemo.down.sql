-- Hand-written rollback for 0029_aromatic_zemo.sql (drizzle-kit is forward-only).
-- Drops the cost_category column on operation_templates (and its check, which the
-- column drop removes automatically). Safe to run repeatedly (IF EXISTS).

ALTER TABLE "operation_templates" DROP CONSTRAINT IF EXISTS "operation_templates_cost_category_check";--> statement-breakpoint
ALTER TABLE "operation_templates" DROP COLUMN IF EXISTS "cost_category";

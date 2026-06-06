-- Hand-written rollback for 0030_unusual_lockheed.sql (drizzle-kit is forward-only).
-- Drops the geometry columns + status check on parts. Dropping a column removes any
-- constraint on it, but the check is dropped explicitly first for clarity. Safe to
-- run repeatedly (IF EXISTS).

ALTER TABLE "parts" DROP CONSTRAINT IF EXISTS "parts_geometry_status_check";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_extracted_at";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_bend_count";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_pierce_count";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_cut_length_mm";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_surface_area_mm2";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_volume_mm3";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_bbox_z_mm";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_bbox_y_mm";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_bbox_x_mm";--> statement-breakpoint
ALTER TABLE "parts" DROP COLUMN IF EXISTS "geometry_status";

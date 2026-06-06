ALTER TABLE "parts" ADD COLUMN "geometry_status" text;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_bbox_x_mm" real;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_bbox_y_mm" real;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_bbox_z_mm" real;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_volume_mm3" double precision;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_surface_area_mm2" double precision;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_cut_length_mm" double precision;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_pierce_count" integer;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_bend_count" integer;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "geometry_extracted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_geometry_status_check" CHECK ("parts"."geometry_status" IS NULL OR "parts"."geometry_status" IN ('pending', 'processing', 'ready', 'failed'));
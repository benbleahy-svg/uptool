ALTER TABLE "parts" ADD COLUMN "thumbnail_key" text;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "thumbnail_status" text;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_thumbnail_status_check" CHECK ("parts"."thumbnail_status" IS NULL OR "parts"."thumbnail_status" IN ('pending', 'ready', 'failed'));
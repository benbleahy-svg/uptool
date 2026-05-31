ALTER TABLE "parts" ADD COLUMN "is_no_bid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "declined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "declined_reason" text;
ALTER TABLE "part_operations" ADD COLUMN "operation_type" text DEFAULT 'machining' NOT NULL;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "notes_external" text;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "notes_internal" text;
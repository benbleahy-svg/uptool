ALTER TABLE "attachments" ADD COLUMN "part_id" uuid REFERENCES "parts"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX "idx_attachments_part" ON "attachments" ("part_id");

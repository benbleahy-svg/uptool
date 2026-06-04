ALTER TABLE "parts" ADD COLUMN "parent_part_id" uuid;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "assembly_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_parent_part_id_parts_id_fk" FOREIGN KEY ("parent_part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_parts_parent" ON "parts" USING btree ("parent_part_id");
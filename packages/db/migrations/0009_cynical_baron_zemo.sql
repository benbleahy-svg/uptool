ALTER TABLE "orgs" ALTER COLUMN "rfq_counter" SET DEFAULT 1000;--> statement-breakpoint
UPDATE "orgs" SET "rfq_counter" = 1001 WHERE "rfq_counter" < 1001;--> statement-breakpoint
UPDATE "rfqs" SET "rfq_number" = 1001 WHERE "rfq_number" = 1;
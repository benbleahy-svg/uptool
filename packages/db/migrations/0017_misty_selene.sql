-- Remove 'won'/'lost' from rfq_status. Won/Lost are no longer part of the RFQ
-- lifecycle. Any RFQ left in those states had previously been sent, so it lands
-- on 'sent'. Reassignment must happen while the column is plain text — before the
-- type is recreated without the values — or the cast back would fail.
ALTER TABLE "public"."rfqs" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public"."rfqs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."rfqs" SET "status" = 'sent' WHERE "status" IN ('won', 'lost');--> statement-breakpoint
DROP TYPE "public"."rfq_status";--> statement-breakpoint
CREATE TYPE "public"."rfq_status" AS ENUM('new', 'estimated', 'quoted', 'sent', 'no_bid');--> statement-breakpoint
ALTER TABLE "public"."rfqs" ALTER COLUMN "status" SET DATA TYPE "public"."rfq_status" USING "status"::"public"."rfq_status";--> statement-breakpoint
ALTER TABLE "public"."rfqs" ALTER COLUMN "status" SET DEFAULT 'new';

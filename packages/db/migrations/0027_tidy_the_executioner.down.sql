-- Hand-written rollback for 0027_tidy_the_executioner.sql (drizzle-kit is
-- forward-only). Drops the uniqueness constraint. The duplicate-renumber and
-- rfq_counter bump are intentionally NOT reverted — re-introducing a duplicate
-- rfq_number would be a regression, and the new numbers are valid. Safe to run
-- repeatedly (IF EXISTS).

ALTER TABLE "rfqs" DROP CONSTRAINT IF EXISTS "rfqs_org_id_rfq_number_unique";

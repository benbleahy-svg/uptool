-- Data fix BEFORE adding the constraint: resolve any duplicate (org_id,
-- rfq_number) rows. Keep the earliest-created row per group (the seeded/original)
-- and renumber the rest to fresh numbers above each org's current max. General
-- (not hardcoded to the known 1005 collision) so it's safe in any environment;
-- a no-op where there are no duplicates.
WITH ranked AS (
  SELECT id, org_id,
         row_number() OVER (PARTITION BY org_id, rfq_number ORDER BY created_at, id) AS rn
  FROM rfqs
),
maxnum AS (
  SELECT org_id, max(rfq_number) AS maxn FROM rfqs GROUP BY org_id
),
renum AS (
  SELECT r.id,
         m.maxn + row_number() OVER (PARTITION BY r.org_id ORDER BY r.id) AS new_number
  FROM ranked r
  JOIN maxnum m ON m.org_id = r.org_id
  WHERE r.rn > 1
)
UPDATE rfqs SET rfq_number = renum.new_number FROM renum WHERE rfqs.id = renum.id;--> statement-breakpoint
-- Lift each org's rfq_counter to at least its max rfq_number so future ingest
-- (rfq_counter + 1) never re-issues an existing number.
UPDATE orgs o
SET rfq_counter = GREATEST(o.rfq_counter, sub.maxn)
FROM (SELECT org_id, max(rfq_number) AS maxn FROM rfqs GROUP BY org_id) sub
WHERE sub.org_id = o.id;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_org_id_rfq_number_unique" UNIQUE("org_id","rfq_number");

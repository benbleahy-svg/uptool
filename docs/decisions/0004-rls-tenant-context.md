# 0004 — SET LOCAL for RLS tenant context

**Date:** 2026-05-27

## Context

All tenant-scoped tables (`memberships`, `audit_log`, `ai_runs`) have RLS enabled with policy:
```sql
org_id = current_setting('app.org_id', true)::uuid
```

Every DB transaction touching these tables must run `SET LOCAL app.org_id = '<uuid>'` before the query.

**Org creation special case:** When creating a new org, the user has no membership yet — so `app.org_id` is not set. But we need to INSERT into `memberships` (RLS-protected) immediately after creating the org. Solution: within the same transaction, after inserting the org row, run `SET LOCAL app.org_id = newOrg.id`, then insert the membership. The RLS policy is satisfied because `org_id = app.org_id` in that transaction.

## Decision

- `withOrgContext(orgId, fn)` in `packages/db/src/with-org-context.ts` wraps all tenant DB calls
- `orgService.create()` uses a plain `db.transaction()` that manually sets `app.org_id` after org creation
- No Postgres superuser or `BYPASSRLS` role needed for application code

## Consequences

- Every service function touching tenant data must use `withOrgContext` — enforced by code review
- Forgetting `withOrgContext` is a silent bug (query returns 0 rows rather than throwing), which is safer than a data leak
- Admin operations (Epic 2+) will require a separate privileged DB role

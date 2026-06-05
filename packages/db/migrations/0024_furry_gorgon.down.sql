-- Hand-written rollback for 0024_furry_gorgon.sql (drizzle-kit is
-- forward-only). Drops the unique index that backs
-- emailAccountService.connect()'s onConflictDoUpdate target [orgId, email].
-- Safe to run repeatedly (IF EXISTS).

DROP INDEX IF EXISTS "uniq_email_accounts_org_email";

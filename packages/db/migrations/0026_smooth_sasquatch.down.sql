-- Hand-written rollback for 0026_smooth_sasquatch.sql (drizzle-kit is
-- forward-only). Reverts the reconnect_required flag, drops the send-side
-- indexes/columns + the owner FK. Safe to run repeatedly (IF EXISTS).

UPDATE "email_accounts" SET "status" = 'connected'
  WHERE "provider" IN ('gmail', 'microsoft') AND "status" = 'reconnect_required';--> statement-breakpoint
DROP INDEX IF EXISTS "uniq_default_send_per_org";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_email_accounts_org_owner";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP CONSTRAINT IF EXISTS "email_accounts_owner_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "smtp_password";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "smtp_tls";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "smtp_port";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "smtp_host";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "is_default_send";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "owner_user_id";

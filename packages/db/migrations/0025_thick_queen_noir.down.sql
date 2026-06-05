-- Hand-written rollback for 0025_thick_queen_noir.sql (drizzle-kit is
-- forward-only). Drops the IMAP connection columns and the widened provider
-- CHECK constraint added for IMAP support. Safe to run repeatedly (IF EXISTS).

ALTER TABLE "email_accounts" DROP CONSTRAINT IF EXISTS "email_accounts_provider_check";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "imap_password";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "imap_tls";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "imap_port";--> statement-breakpoint
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "imap_host";

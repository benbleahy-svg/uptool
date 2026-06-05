ALTER TABLE "email_accounts" ADD COLUMN "imap_host" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "imap_port" integer;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "imap_tls" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "imap_password" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_provider_check" CHECK ("email_accounts"."provider" IN ('microsoft', 'gmail', 'imap'));
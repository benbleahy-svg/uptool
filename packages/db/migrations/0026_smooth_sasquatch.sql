ALTER TABLE "email_accounts" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "is_default_send" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "smtp_tls" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "smtp_password" text;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_accounts_org_owner" ON "email_accounts" USING btree ("org_id","owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_default_send_per_org" ON "email_accounts" USING btree ("org_id") WHERE "email_accounts"."is_default_send" = true;--> statement-breakpoint
-- OAuth send scopes (gmail.send / Mail.Send) were not granted at original consent.
-- Flag connected Gmail/Microsoft accounts so the UI can prompt re-consent.
-- IMAP accounts send via SMTP and are unaffected.
UPDATE "email_accounts" SET "status" = 'reconnect_required'
  WHERE "provider" IN ('gmail', 'microsoft') AND "status" = 'connected';
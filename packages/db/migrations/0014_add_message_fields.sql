ALTER TABLE "email_messages" ADD COLUMN "cc_emails" text[];
ALTER TABLE "email_messages" ADD COLUMN "bcc_emails" text[];
ALTER TABLE "email_messages" ADD COLUMN "status" text;
CREATE INDEX "idx_attachments_message" ON "attachments" ("message_id");

CREATE TABLE "operation_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"operation_type" text DEFAULT 'machining' NOT NULL,
	"default_setup_minutes" numeric DEFAULT '0' NOT NULL,
	"default_run_minutes" numeric DEFAULT '0' NOT NULL,
	"default_hourly_rate_cents" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operation_templates" ADD CONSTRAINT "operation_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_operation_templates_org" ON "operation_templates" USING btree ("org_id");
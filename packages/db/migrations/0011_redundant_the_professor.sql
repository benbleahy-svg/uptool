CREATE TYPE "public"."customer_source" AS ENUM('signature_parsed', 'ai_extracted', 'domain_derived', 'free_provider_fallback', 'manual');--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "source" "customer_source";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "extraction_confidence" numeric(4, 2);
CREATE TYPE "whatsapp_coexistence_contact_sync_status" AS ENUM('ATTEMPTED', 'ACCEPTED', 'FAILED');--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_status" "whatsapp_coexistence_contact_sync_status";--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_provider_request_id" varchar(255);--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_failure_category" varchar(64);--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_provider_error_code" varchar(64);--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD COLUMN "coexistence_contact_sync_provider_error_subcode" varchar(64);--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD CONSTRAINT "whatsapp_onboarding_transactions_contact_sync_state_valid" CHECK (
  ("coexistence_contact_sync_status" IS NULL AND "coexistence_contact_sync_attempted_at" IS NULL)
  OR ("coexistence_contact_sync_status" IS NOT NULL AND "coexistence_contact_sync_attempted_at" IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD CONSTRAINT "whatsapp_onboarding_transactions_contact_sync_acceptance_valid" CHECK (
  "coexistence_contact_sync_status" <> 'ACCEPTED'
  OR ("coexistence_contact_sync_accepted_at" IS NOT NULL AND "coexistence_contact_sync_provider_request_id" IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD CONSTRAINT "whatsapp_onboarding_transactions_contact_sync_failure_valid" CHECK (
  "coexistence_contact_sync_status" <> 'FAILED'
  OR ("coexistence_contact_sync_failure_category" IS NOT NULL AND "coexistence_contact_sync_provider_error_code" IS NOT NULL)
);

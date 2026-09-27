CREATE TYPE "whatsapp_onboarding_transaction_status" AS ENUM('STARTED', 'COMPLETED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "whatsapp_onboarding_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"provider" "whatsapp_connection_provider" NOT NULL,
	"connection_source" "whatsapp_connection_source" NOT NULL,
	"status" "whatsapp_onboarding_transaction_status" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_onboarding_transactions_expiry_after_creation" CHECK ("expires_at" > "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_onboarding_transactions_active_organization_unique" ON "whatsapp_onboarding_transactions" ("organization_id") WHERE "status" = 'STARTED';--> statement-breakpoint
CREATE INDEX "whatsapp_onboarding_tx_org_status_expires_idx" ON "whatsapp_onboarding_transactions" ("organization_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "whatsapp_onboarding_transactions_actor_user_id_idx" ON "whatsapp_onboarding_transactions" ("actor_user_id");--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD CONSTRAINT "whatsapp_onboarding_transactions_Yg37t5t81QLR_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "whatsapp_onboarding_transactions" ADD CONSTRAINT "whatsapp_onboarding_transactions_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
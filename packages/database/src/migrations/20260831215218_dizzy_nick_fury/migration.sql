CREATE TYPE "whatsapp_connection_provider" AS ENUM('META');--> statement-breakpoint
CREATE TYPE "whatsapp_connection_source" AS ENUM('EXISTING_BUSINESS_APP', 'NEW_NUMBER', 'EXISTING_PLATFORM');--> statement-breakpoint
CREATE TYPE "whatsapp_connection_status" AS ENUM('PENDING', 'VERIFYING', 'CONNECTED', 'FAILED', 'DISCONNECTED');--> statement-breakpoint
CREATE TABLE "whatsapp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"provider" "whatsapp_connection_provider" NOT NULL,
	"connection_source" "whatsapp_connection_source" NOT NULL,
	"connection_status" "whatsapp_connection_status" NOT NULL,
	"external_waba_id" varchar(255),
	"external_phone_number_id" varchar(255),
	"display_phone_number" varchar(64),
	"credential_reference" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_connections_connected_details_required" CHECK (("connection_status" <> 'CONNECTED') or (
        "external_waba_id" is not null and
        "external_phone_number_id" is not null and
        "credential_reference" is not null
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_organization_id_unique" ON "whatsapp_connections" ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_provider_phone_number_unique" ON "whatsapp_connections" ("provider","external_phone_number_id");--> statement-breakpoint
CREATE INDEX "whatsapp_connections_organization_status_idx" ON "whatsapp_connections" ("organization_id","connection_status");--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
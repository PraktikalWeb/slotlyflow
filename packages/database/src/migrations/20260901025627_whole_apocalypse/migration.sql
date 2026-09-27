CREATE TABLE "provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"provider" "whatsapp_connection_provider" NOT NULL,
	"encryption_version" varchar(32) NOT NULL,
	"nonce" varchar(64) NOT NULL,
	"ciphertext" varchar(8192) NOT NULL,
	"authentication_tag" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "provider_credentials_organization_provider_idx" ON "provider_credentials" ("organization_id","provider");--> statement-breakpoint
ALTER TABLE "provider_credentials" ADD CONSTRAINT "provider_credentials_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
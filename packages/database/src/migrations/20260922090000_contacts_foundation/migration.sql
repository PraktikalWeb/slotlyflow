CREATE TYPE "contact_origin" AS ENUM('COEXISTENCE_IMPORT', 'INBOUND_MESSAGE');--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connections_organization_id_id_unique" ON "whatsapp_connections" ("organization_id", "id");--> statement-breakpoint
CREATE TABLE "contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "whatsapp_connection_id" uuid NOT NULL,
  "whatsapp_id" varchar(64) NOT NULL,
  "phone_number" varchar(32) NOT NULL,
  "origin" "contact_origin" NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_connection_fkey" FOREIGN KEY ("organization_id", "whatsapp_connection_id") REFERENCES "whatsapp_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_org_connection_whatsapp_id_unique" ON "contacts" ("organization_id", "whatsapp_connection_id", "whatsapp_id");--> statement-breakpoint
CREATE INDEX "contacts_organization_connection_created_idx" ON "contacts" ("organization_id", "whatsapp_connection_id", "created_at");--> statement-breakpoint
INSERT INTO "contacts" (
  "organization_id",
  "whatsapp_connection_id",
  "whatsapp_id",
  "phone_number",
  "origin",
  "created_at",
  "updated_at"
)
SELECT
  "organization_id",
  "whatsapp_connection_id",
  "customer_whatsapp_id",
  '+' || "customer_whatsapp_id",
  'INBOUND_MESSAGE'::"contact_origin",
  "created_at",
  "updated_at"
FROM "conversations"
WHERE "customer_whatsapp_id" ~ '^[1-9][0-9]{6,14}$'
ON CONFLICT ("organization_id", "whatsapp_connection_id", "whatsapp_id") DO NOTHING;

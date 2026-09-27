CREATE TYPE "message_direction" AS ENUM('INBOUND', 'OUTBOUND');--> statement-breakpoint
CREATE TYPE "message_type" AS ENUM('TEXT', 'UNSUPPORTED');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"whatsapp_connection_id" uuid NOT NULL,
	"customer_whatsapp_id" varchar(64) NOT NULL,
	"customer_display_name" varchar(256),
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"whatsapp_connection_id" uuid NOT NULL,
	"provider" "whatsapp_connection_provider" NOT NULL,
	"provider_message_id" varchar(255) NOT NULL,
	"direction" "message_direction" NOT NULL,
	"message_type" "message_type" NOT NULL,
	"text_body" text,
	"provider_timestamp" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_org_connection_customer_unique" ON "conversations" ("organization_id","whatsapp_connection_id","customer_whatsapp_id");--> statement-breakpoint
CREATE INDEX "conversations_organization_last_message_idx" ON "conversations" ("organization_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_connection_last_message_idx" ON "conversations" ("whatsapp_connection_id","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_provider_message_id_unique" ON "messages" ("provider","provider_message_id");--> statement-breakpoint
CREATE INDEX "messages_organization_conversation_created_idx" ON "messages" ("organization_id","conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_connection_provider_timestamp_idx" ON "messages" ("whatsapp_connection_id","provider_timestamp");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_qGyFRVanhhwv_fkey" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_whatsapp_connection_id_whatsapp_connections_id_fkey" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
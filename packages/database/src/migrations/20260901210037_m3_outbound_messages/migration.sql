CREATE TYPE "outbound_message_status" AS ENUM('ACCEPTED', 'SENT', 'DELIVERED', 'READ', 'FAILED');--> statement-breakpoint
CREATE TYPE "outbound_message_request_state" AS ENUM('PENDING', 'COMPLETED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "outbound_message_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"whatsapp_connection_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"text_body" text NOT NULL,
	"state" "outbound_message_request_state" DEFAULT 'PENDING'::"outbound_message_request_state" NOT NULL,
	"message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "outbound_status" "outbound_message_status";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "outbound_status_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "messages_outbound_provider_status_idx" ON "messages" ("whatsapp_connection_id","outbound_status","outbound_status_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_message_requests_organization_idempotency_unique" ON "outbound_message_requests" ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "outbound_message_requests_conversation_state_idx" ON "outbound_message_requests" ("conversation_id","state");--> statement-breakpoint
ALTER TABLE "outbound_message_requests" ADD CONSTRAINT "outbound_message_requests_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "outbound_message_requests" ADD CONSTRAINT "outbound_message_requests_conversation_id_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "outbound_message_requests" ADD CONSTRAINT "outbound_message_requests_aSHGPrxIeyGA_fkey" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "outbound_message_requests" ADD CONSTRAINT "outbound_message_requests_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_outbound_status_only_for_outbound" CHECK (("outbound_status" is null) or ("direction" = 'OUTBOUND'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_outbound_status_timestamp_pair" CHECK (("outbound_status" is null and "outbound_status_updated_at" is null) or ("outbound_status" is not null and "outbound_status_updated_at" is not null));
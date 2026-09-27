CREATE TYPE "whatsapp_connection_test_status" AS ENUM('IN_PROGRESS', 'PASSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "whatsapp_connection_test_stage" AS ENUM('WAITING_FOR_MESSAGE', 'MESSAGE_RECEIVED', 'REPLY_SENT', 'PASSED', 'FAILED');--> statement-breakpoint
CREATE TABLE "whatsapp_connection_tests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "whatsapp_connection_id" uuid NOT NULL,
  "destination_phone_number_id" varchar(255) NOT NULL,
  "test_sender_phone_number" varchar(32) NOT NULL,
  "status" "whatsapp_connection_test_status" NOT NULL DEFAULT 'IN_PROGRESS',
  "stage" "whatsapp_connection_test_stage" NOT NULL DEFAULT 'WAITING_FOR_MESSAGE',
  "inbound_provider_message_id" varchar(255),
  "failure_code" varchar(64),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "inbound_received_at" timestamp with time zone,
  "reply_sent_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "whatsapp_connection_tests_terminal_timestamp" CHECK (("status" = 'IN_PROGRESS') OR ("completed_at" IS NOT NULL))
);--> statement-breakpoint
ALTER TABLE "whatsapp_connection_tests" ADD CONSTRAINT "whatsapp_connection_tests_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "whatsapp_connection_tests" ADD CONSTRAINT "whatsapp_connection_tests_connection_id_whatsapp_connections_id_fkey" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "whatsapp_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connection_tests_one_active_per_connection" ON "whatsapp_connection_tests" ("whatsapp_connection_id") WHERE "status" = 'IN_PROGRESS';--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_connection_tests_inbound_message_unique" ON "whatsapp_connection_tests" ("inbound_provider_message_id") WHERE "inbound_provider_message_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_connection_tests_lookup_idx" ON "whatsapp_connection_tests" ("destination_phone_number_id", "test_sender_phone_number", "status", "expires_at");--> statement-breakpoint
CREATE INDEX "whatsapp_connection_tests_organization_connection_idx" ON "whatsapp_connection_tests" ("organization_id", "whatsapp_connection_id", "created_at");

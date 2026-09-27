CREATE UNIQUE INDEX "conversations_execution_context_unique" ON "conversations" ("organization_id", "whatsapp_connection_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_deployments_execution_context_unique" ON "bot_deployments" ("organization_id", "whatsapp_connection_id", "id", "bot_version_id");--> statement-breakpoint

CREATE TABLE "bot_conversation_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "whatsapp_connection_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "bot_deployment_id" uuid NOT NULL,
  "bot_version_id" uuid NOT NULL,
  "state" varchar(64) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "bot_conversation_states" ADD CONSTRAINT "bot_conversation_states_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_conversation_states" ADD CONSTRAINT "bot_conversation_states_organization_connection_fkey" FOREIGN KEY ("organization_id", "whatsapp_connection_id") REFERENCES "whatsapp_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_conversation_states" ADD CONSTRAINT "bot_conversation_states_conversation_context_fkey" FOREIGN KEY ("organization_id", "whatsapp_connection_id", "conversation_id") REFERENCES "conversations"("organization_id", "whatsapp_connection_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_conversation_states" ADD CONSTRAINT "bot_conversation_states_deployment_context_fkey" FOREIGN KEY ("organization_id", "whatsapp_connection_id", "bot_deployment_id", "bot_version_id") REFERENCES "bot_deployments"("organization_id", "whatsapp_connection_id", "id", "bot_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_conversation_states" ADD CONSTRAINT "bot_conversation_states_bot_version_id_bot_versions_id_fkey" FOREIGN KEY ("bot_version_id") REFERENCES "bot_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_conversation_states_execution_context_unique" ON "bot_conversation_states" ("organization_id", "conversation_id", "bot_deployment_id", "bot_version_id");--> statement-breakpoint
CREATE INDEX "bot_conversation_states_connection_conversation_idx" ON "bot_conversation_states" ("organization_id", "whatsapp_connection_id", "conversation_id");--> statement-breakpoint

ALTER TABLE "messages" ADD COLUMN "interactive_option_id" varchar(255);--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "interactive_options" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_interactive_reply_only_for_inbound" CHECK (("interactive_option_id" is null) or ("direction" = 'INBOUND'));--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_interactive_options_only_for_outbound" CHECK (("interactive_options" is null) or ("direction" = 'OUTBOUND'));--> statement-breakpoint
ALTER TABLE "outbound_message_requests" ADD COLUMN "interactive_options" jsonb;

ALTER TABLE "bot_conversation_states" ADD COLUMN "data" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "handover_assignments" DROP CONSTRAINT "handover_assignments_state_consistent";--> statement-breakpoint
ALTER TYPE "handover_assignment_status" RENAME TO "handover_assignment_status_old";--> statement-breakpoint
CREATE TYPE "handover_assignment_status" AS ENUM ('WAITING', 'ASSIGNED', 'CLOSED');--> statement-breakpoint
ALTER TABLE "handover_assignments" ALTER COLUMN "status" TYPE "handover_assignment_status" USING "status"::text::"handover_assignment_status";--> statement-breakpoint
DROP TYPE "handover_assignment_status_old";--> statement-breakpoint
CREATE TYPE "handover_close_reason" AS ENUM ('inactivity_timeout', 'manual');--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD COLUMN "handover_auto_close_enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD COLUMN "handover_inactivity_minutes" integer NOT NULL DEFAULT 1440;--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD CONSTRAINT "organization_notification_settings_handover_inactivity_bounds" CHECK ("handover_inactivity_minutes" between 15 and 43200);--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD COLUMN "last_activity_at" timestamp with time zone NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD COLUMN "auto_close_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD COLUMN "closed_reason" "handover_close_reason";--> statement-breakpoint
UPDATE "handover_assignments" SET "last_activity_at" = greatest("created_at", "updated_at"), "auto_close_at" = greatest("created_at", "updated_at") + interval '24 hours';--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_state_consistent" CHECK (("status" = 'WAITING' AND "assignee_membership_id" IS NULL) OR ("status" = 'ASSIGNED' AND "team_id" IS NOT NULL AND "assignee_membership_id" IS NOT NULL AND "assigned_at" IS NOT NULL) OR ("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "closed_reason" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_active_close_metadata" CHECK ("status" = 'CLOSED' OR ("closed_at" IS NULL AND "closed_reason" IS NULL));--> statement-breakpoint
DROP INDEX "handover_assignments_organization_conversation_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "handover_assignments_organization_conversation_active_unique" ON "handover_assignments" ("organization_id", "conversation_id") WHERE "status" IN ('WAITING', 'ASSIGNED');--> statement-breakpoint
CREATE INDEX "handover_assignments_due_idx" ON "handover_assignments" ("auto_close_at", "id") WHERE "status" IN ('WAITING', 'ASSIGNED') AND "auto_close_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD COLUMN "last_human_activity_at" timestamp with time zone;
--> statement-breakpoint
CREATE TYPE "message_origin" AS ENUM ('CUSTOMER_INBOUND', 'SLOTLYFLOW_API_OUTBOUND', 'BUSINESS_APP_OUTBOUND');
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "origin" "message_origin";
--> statement-breakpoint
UPDATE "messages" SET "origin" = CASE WHEN "direction" = 'INBOUND' THEN 'CUSTOMER_INBOUND'::"message_origin" ELSE 'SLOTLYFLOW_API_OUTBOUND'::"message_origin" END;
--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "origin" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_origin_direction_consistent" CHECK (("origin" = 'CUSTOMER_INBOUND' AND "direction" = 'INBOUND') OR ("origin" IN ('SLOTLYFLOW_API_OUTBOUND', 'BUSINESS_APP_OUTBOUND') AND "direction" = 'OUTBOUND'));

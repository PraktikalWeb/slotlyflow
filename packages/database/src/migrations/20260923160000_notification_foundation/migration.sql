CREATE TYPE "handover_assignment_status" AS ENUM('WAITING', 'ASSIGNED');--> statement-breakpoint
CREATE TYPE "notification_type" AS ENUM('HANDOVER_ASSIGNED');--> statement-breakpoint
CREATE TYPE "notification_resource_type" AS ENUM('CONVERSATION');--> statement-breakpoint
CREATE TYPE "notification_delivery_channel" AS ENUM('EMAIL');--> statement-breakpoint
CREATE TYPE "notification_delivery_status" AS ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'FAILED_PERMANENTLY', 'BLOCKED');--> statement-breakpoint

CREATE UNIQUE INDEX "organization_members_organization_id_id_unique" ON "organization_members" ("organization_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_organization_id_id_user_id_unique" ON "organization_members" ("organization_id", "id", "user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_organization_id_id_unique" ON "conversations" ("organization_id", "id");--> statement-breakpoint

CREATE TABLE "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "name" varchar(120) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_organization_id_id_unique" ON "teams" ("organization_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_organization_name_unique" ON "teams" ("organization_id", "name");--> statement-breakpoint
CREATE INDEX "teams_organization_created_idx" ON "teams" ("organization_id", "created_at");--> statement-breakpoint

CREATE TABLE "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "team_id" uuid NOT NULL,
  "organization_member_id" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organization_team_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organization_membership_fkey" FOREIGN KEY ("organization_id", "organization_member_id") REFERENCES "organization_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_membership_unique" ON "team_members" ("team_id", "organization_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_organization_team_membership_unique" ON "team_members" ("organization_id", "team_id", "organization_member_id");--> statement-breakpoint
CREATE INDEX "team_members_organization_team_idx" ON "team_members" ("organization_id", "team_id");--> statement-breakpoint

CREATE TABLE "organization_notification_settings" (
  "organization_id" uuid PRIMARY KEY,
  "handover_team_id" uuid,
  "fallback_email_addresses" text[] NOT NULL DEFAULT '{}'::text[],
  "email_notifications_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD CONSTRAINT "organization_notification_settings_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_notification_settings" ADD CONSTRAINT "organization_notification_settings_handover_team_fkey" FOREIGN KEY ("organization_id", "handover_team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint

CREATE TABLE "user_notification_preferences" (
  "user_id" uuid PRIMARY KEY,
  "preferred_email" varchar(320),
  "email_notifications_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint

CREATE TABLE "handover_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "team_id" uuid,
  "assignee_membership_id" uuid,
  "status" "handover_assignment_status" NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "assigned_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "handover_assignments_state_consistent" CHECK (("status" = 'WAITING' and "assignee_membership_id" is null) or ("status" = 'ASSIGNED' and "team_id" is not null and "assignee_membership_id" is not null and "assigned_at" is not null))
);--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_organization_conversation_fkey" FOREIGN KEY ("organization_id", "conversation_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_organization_team_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_organization_membership_fkey" FOREIGN KEY ("organization_id", "assignee_membership_id") REFERENCES "organization_members"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "handover_assignments" ADD CONSTRAINT "handover_assignments_team_assignee_fkey" FOREIGN KEY ("organization_id", "team_id", "assignee_membership_id") REFERENCES "team_members"("organization_id", "team_id", "organization_member_id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "handover_assignments_organization_conversation_unique" ON "handover_assignments" ("organization_id", "conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "handover_assignments_organization_id_id_unique" ON "handover_assignments" ("organization_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "handover_assignments_organization_id_conversation_unique" ON "handover_assignments" ("organization_id", "id", "conversation_id");--> statement-breakpoint
CREATE INDEX "handover_assignments_team_status_assigned_idx" ON "handover_assignments" ("organization_id", "team_id", "status", "assigned_at", "id");--> statement-breakpoint

CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "type" "notification_type" NOT NULL,
  "recipient_user_id" uuid,
  "recipient_membership_id" uuid,
  "team_id" uuid,
  "handover_assignment_id" uuid NOT NULL,
  "resource_type" "notification_resource_type" NOT NULL,
  "resource_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" varchar(1000) NOT NULL,
  "deduplication_key" varchar(255) NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_recipient_pair_consistent" CHECK (("recipient_user_id" is null and "recipient_membership_id" is null) or ("recipient_user_id" is not null and "recipient_membership_id" is not null))
);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_recipient_membership_user_fkey" FOREIGN KEY ("organization_id", "recipient_membership_id", "recipient_user_id") REFERENCES "organization_members"("organization_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_team_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_handover_assignment_fkey" FOREIGN KEY ("organization_id", "handover_assignment_id") REFERENCES "handover_assignments"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assignment_conversation_fkey" FOREIGN KEY ("organization_id", "handover_assignment_id", "resource_id") REFERENCES "handover_assignments"("organization_id", "id", "conversation_id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_conversation_resource_fkey" FOREIGN KEY ("organization_id", "resource_id") REFERENCES "conversations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_organization_id_id_unique" ON "notifications" ("organization_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_organization_id_recipient_unique" ON "notifications" ("organization_id", "id", "recipient_membership_id", "recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_deduplication_key_unique" ON "notifications" ("deduplication_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" ("organization_id", "recipient_user_id", "created_at", "id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_created_idx" ON "notifications" ("organization_id", "recipient_user_id", "read_at", "created_at");--> statement-breakpoint

CREATE TABLE "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "recipient_user_id" uuid,
  "recipient_membership_id" uuid,
  "channel" "notification_delivery_channel" NOT NULL DEFAULT 'EMAIL',
  "destination" varchar(320) NOT NULL,
  "status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "provider_message_id" varchar(255),
  "last_error_code" varchar(64),
  "failure_classification" varchar(64),
  "next_attempt_at" timestamp with time zone,
  "locked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "sent_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "notification_deliveries_attempt_count_non_negative" CHECK ("attempt_count" >= 0),
  CONSTRAINT "notification_deliveries_recipient_pair_consistent" CHECK (("recipient_user_id" is null and "recipient_membership_id" is null) or ("recipient_user_id" is not null and "recipient_membership_id" is not null))
);--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_notification_fkey" FOREIGN KEY ("organization_id", "notification_id") REFERENCES "notifications"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_recipient_fkey" FOREIGN KEY ("organization_id", "notification_id", "recipient_membership_id", "recipient_user_id") REFERENCES "notifications"("organization_id", "id", "recipient_membership_id", "recipient_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_recipient_membership_user_fkey" FOREIGN KEY ("organization_id", "recipient_membership_id", "recipient_user_id") REFERENCES "organization_members"("organization_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_destination_unique" ON "notification_deliveries" ("notification_id", "channel", "destination");--> statement-breakpoint
CREATE INDEX "notification_deliveries_claim_idx" ON "notification_deliveries" ("status", "next_attempt_at", "locked_at", "created_at", "id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_organization_created_idx" ON "notification_deliveries" ("organization_id", "created_at");

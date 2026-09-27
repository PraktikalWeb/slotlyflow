CREATE TYPE "bot_definition_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "bot_version_status" AS ENUM('PUBLISHED', 'RETIRED');--> statement-breakpoint
CREATE TYPE "bot_deployment_status" AS ENUM('INACTIVE', 'ACTIVE');--> statement-breakpoint

CREATE TABLE "bot_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "definition_key" varchar(120) NOT NULL,
  "name" varchar(160) NOT NULL,
  "description" varchar(1000),
  "status" "bot_definition_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "bot_definitions_definition_key_unique" ON "bot_definitions" ("definition_key");--> statement-breakpoint
CREATE INDEX "bot_definitions_status_created_idx" ON "bot_definitions" ("status", "created_at");--> statement-breakpoint

CREATE TABLE "bot_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bot_definition_id" uuid NOT NULL,
  "version" varchar(32) NOT NULL,
  "implementation_key" varchar(160) NOT NULL,
  "configuration_schema" jsonb,
  "status" "bot_version_status" NOT NULL DEFAULT 'PUBLISHED',
  "published_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint
ALTER TABLE "bot_versions" ADD CONSTRAINT "bot_versions_bot_definition_id_fkey" FOREIGN KEY ("bot_definition_id") REFERENCES "bot_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_versions_definition_version_unique" ON "bot_versions" ("bot_definition_id", "version");--> statement-breakpoint
CREATE INDEX "bot_versions_definition_status_published_idx" ON "bot_versions" ("bot_definition_id", "status", "published_at");--> statement-breakpoint

CREATE TABLE "bot_deployments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "whatsapp_connection_id" uuid NOT NULL,
  "bot_version_id" uuid NOT NULL,
  "configuration" jsonb,
  "status" "bot_deployment_status" NOT NULL DEFAULT 'INACTIVE',
  "activated_at" timestamp with time zone,
  "deactivated_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bot_deployments_active_timestamp_required" CHECK (("status" <> 'ACTIVE') or ("activated_at" is not null))
);--> statement-breakpoint
ALTER TABLE "bot_deployments" ADD CONSTRAINT "bot_deployments_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_deployments" ADD CONSTRAINT "bot_deployments_organization_connection_fkey" FOREIGN KEY ("organization_id", "whatsapp_connection_id") REFERENCES "whatsapp_connections"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_deployments" ADD CONSTRAINT "bot_deployments_bot_version_id_fkey" FOREIGN KEY ("bot_version_id") REFERENCES "bot_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_deployments_one_active_per_connection" ON "bot_deployments" ("whatsapp_connection_id") WHERE "status" = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "bot_deployments_organization_connection_status_idx" ON "bot_deployments" ("organization_id", "whatsapp_connection_id", "status");--> statement-breakpoint
CREATE INDEX "bot_deployments_version_created_idx" ON "bot_deployments" ("bot_version_id", "created_at");

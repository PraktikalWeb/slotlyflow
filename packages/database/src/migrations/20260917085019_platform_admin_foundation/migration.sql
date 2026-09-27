CREATE TYPE "organization_lifecycle_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "platform_staff_role" AS ENUM('SUPER_ADMIN', 'SUPPORT', 'BILLING_ADMIN', 'OPERATIONS');--> statement-breakpoint
CREATE TYPE "platform_staff_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "platform_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role" "platform_staff_role" NOT NULL,
	"status" "platform_staff_status" DEFAULT 'ACTIVE'::"platform_staff_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "status" "organization_lifecycle_status" DEFAULT 'ACTIVE'::"organization_lifecycle_status" NOT NULL;--> statement-breakpoint
CREATE INDEX "organizations_status_created_at_idx" ON "organizations" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_staff_user_id_unique" ON "platform_staff" ("user_id");--> statement-breakpoint
CREATE INDEX "platform_staff_role_status_idx" ON "platform_staff" ("role","status");--> statement-breakpoint
CREATE INDEX "platform_staff_created_at_idx" ON "platform_staff" ("created_at");--> statement-breakpoint
ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
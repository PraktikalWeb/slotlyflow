ALTER TYPE "whatsapp_connection_status" ADD VALUE IF NOT EXISTS 'NEEDS_REAUTH';--> statement-breakpoint
ALTER TYPE "whatsapp_connection_status" ADD VALUE IF NOT EXISTS 'CONFLICT';--> statement-breakpoint
CREATE TYPE "whatsapp_connection_verification_status" AS ENUM('VERIFIED', 'CHECK_FAILED');--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD COLUMN "verification_status" "whatsapp_connection_verification_status";--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD COLUMN "last_verification_code" varchar(64);

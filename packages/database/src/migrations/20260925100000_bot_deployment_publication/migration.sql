ALTER TABLE "bot_deployments" ADD COLUMN "is_published" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "bot_deployments" SET "is_published" = true WHERE "status" = 'ACTIVE';

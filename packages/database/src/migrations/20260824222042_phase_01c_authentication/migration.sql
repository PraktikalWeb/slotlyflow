CREATE TYPE "authentication_provider" AS ENUM('PASSWORD', 'GOOGLE');--> statement-breakpoint
CREATE TYPE "oauth_authorization_provider" AS ENUM('GOOGLE');--> statement-breakpoint
CREATE TABLE "authentication_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"provider" "authentication_provider" NOT NULL,
	"provider_subject" varchar(320) NOT NULL,
	"provider_email" varchar(320),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_authorization_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" "oauth_authorization_provider" NOT NULL,
	"state_hash" varchar(255) NOT NULL,
	"nonce_hash" varchar(255) NOT NULL,
	"redirect_uri" varchar(2048) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "authentication_identities_provider_subject_unique" ON "authentication_identities" ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "authentication_identities_user_id_idx" ON "authentication_identities" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_authorization_states_state_hash_unique" ON "oauth_authorization_states" ("state_hash");--> statement-breakpoint
CREATE INDEX "oauth_authorization_states_expires_at_idx" ON "oauth_authorization_states" ("expires_at");--> statement-breakpoint
ALTER TABLE "authentication_identities" ADD CONSTRAINT "authentication_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
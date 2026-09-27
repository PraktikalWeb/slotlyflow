CREATE TYPE "organization_business_day" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');--> statement-breakpoint
CREATE TABLE "organization_business_hours" (
	"organization_id" uuid,
	"day" "organization_business_day",
	"enabled" boolean NOT NULL,
	"opens_at" time(0),
	"closes_at" time(0),
	CONSTRAINT "organization_business_hours_pkey" PRIMARY KEY("organization_id","day"),
	CONSTRAINT "organization_business_hours_valid_schedule" CHECK ((
        ("enabled" = true and "opens_at" is not null and "closes_at" is not null and "opens_at" < "closes_at")
        or
        ("enabled" = false and "opens_at" is null and "closes_at" is null)
      ))
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "business_email" varchar(320);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "contact_number" varchar(40);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "website" varchar(2048);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "timezone" varchar(100) DEFAULT 'Africa/Johannesburg' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_business_hours" ADD CONSTRAINT "organization_business_hours_SexZezXMCKLX_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
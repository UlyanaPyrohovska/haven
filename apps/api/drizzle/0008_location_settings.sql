ALTER TABLE "user_profiles" ADD COLUMN "display_location" varchar(200);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "location_hidden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "share_cross_paths" boolean DEFAULT true NOT NULL;

ALTER TABLE "user_profiles" ADD COLUMN "discoverable" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "show_age" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "show_career" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "show_bio" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "show_interests" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "share_location" boolean DEFAULT true NOT NULL;

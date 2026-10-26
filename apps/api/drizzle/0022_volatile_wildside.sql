ALTER TABLE "user_profiles" ADD COLUMN "location_updated_at" timestamp;--> statement-breakpoint
-- Drop the simulated (seeded) crossings; from now on rows come only from real location updates.
DELETE FROM "crossings";

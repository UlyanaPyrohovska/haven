ALTER TABLE "user_profiles" ADD COLUMN "looking_for" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "user_profiles" SET "looking_for" = 1 WHERE "goal" IN ('To get a date', 'Looking for a serious relationship');--> statement-breakpoint
CREATE INDEX "user_profiles_looking_for_idx" ON "user_profiles" USING btree ("looking_for");

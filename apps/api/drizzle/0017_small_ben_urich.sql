ALTER TABLE "user_profiles" ADD COLUMN "interested_in" smallint[];--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "pref_age_min" smallint;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "pref_age_max" smallint;--> statement-breakpoint
-- Backfill seeded profiles like scripts/seed.ts: opposite gender, own age ±10 (min 18).
UPDATE "user_profiles" SET
	"interested_in" = ARRAY[1 - "gender"]::smallint[],
	"pref_age_min" = GREATEST(18, date_part('year', age("birth_date"))::int - 10),
	"pref_age_max" = date_part('year', age("birth_date"))::int + 10
WHERE "is_synthetic" = true AND "gender" IN (0, 1) AND "birth_date" IS NOT NULL;

-- Seeded friends-pool profiles are open to every gender; only dating keeps the opposite-gender filter.
UPDATE "user_profiles" SET "interested_in" = NULL
WHERE "is_synthetic" = true AND "looking_for" = 0;

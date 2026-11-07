DROP INDEX "interactions_pair_uniq";--> statement-breakpoint
DROP INDEX "user_profiles_user_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_pair_uniq" ON "interactions" USING btree (least("user_a", "user_b"),greatest("user_a", "user_b"));--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");
CREATE TABLE "recommendation_exposures" (
	"id" serial PRIMARY KEY NOT NULL,
	"viewer_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"shown_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matching_config" ADD COLUMN "fairness_mu" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matching_config" ADD COLUMN "exposure_cap" smallint;--> statement-breakpoint
ALTER TABLE "matching_config" ADD COLUMN "exposure_window_days" smallint DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "recommendation_exposures" ADD CONSTRAINT "recommendation_exposures_viewer_id_user_profiles_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_exposures" ADD CONSTRAINT "recommendation_exposures_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendation_exposures_candidate_shown_idx" ON "recommendation_exposures" USING btree ("candidate_id","shown_at");
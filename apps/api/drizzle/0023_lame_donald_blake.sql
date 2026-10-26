CREATE TABLE "location_walkers" (
	"walker_id" integer PRIMARY KEY NOT NULL,
	"target_id" integer NOT NULL,
	"center_lat" double precision NOT NULL,
	"center_lon" double precision NOT NULL,
	"radius_m" integer DEFAULT 800 NOT NULL,
	"step_m" integer DEFAULT 150 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_step_at" timestamp,
	"original_lat" double precision,
	"original_lon" double precision,
	"original_display_location" varchar(200),
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "location_walkers" ADD CONSTRAINT "location_walkers_walker_id_user_profiles_id_fk" FOREIGN KEY ("walker_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_walkers" ADD CONSTRAINT "location_walkers_target_id_user_profiles_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_walkers_target_idx" ON "location_walkers" USING btree ("target_id");
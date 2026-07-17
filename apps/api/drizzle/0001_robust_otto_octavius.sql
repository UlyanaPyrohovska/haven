CREATE TABLE "friendships" (
	"user_a" integer NOT NULL,
	"user_b" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_user_a_user_b_pk" PRIMARY KEY("user_a","user_b")
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_a" integer NOT NULL,
	"user_b" integer NOT NULL,
	"distance_km" real,
	"score_a_to_b" real,
	"score_b_to_a" real,
	"dec_a" smallint,
	"dec_b" smallint,
	"match" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"score" real,
	"rank" smallint,
	"shown_at" timestamp DEFAULT now() NOT NULL,
	"acted_on" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_embeddings" (
	"user_profile_id" integer PRIMARY KEY NOT NULL,
	"bio" vector(384),
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255),
	"gender" smallint,
	"age" smallint,
	"ethnicity" varchar(100),
	"career" varchar(100),
	"goal" varchar(100),
	"latitude" double precision,
	"longitude" double precision,
	"bio" text,
	"interest_sports" smallint,
	"interest_tvsports" smallint,
	"interest_exercise" smallint,
	"interest_dining" smallint,
	"interest_museums" smallint,
	"interest_art" smallint,
	"interest_hiking" smallint,
	"interest_gaming" smallint,
	"interest_clubbing" smallint,
	"interest_reading" smallint,
	"interest_tv" smallint,
	"interest_theater" smallint,
	"interest_movies" smallint,
	"interest_concerts" smallint,
	"interest_music" smallint,
	"interest_shopping" smallint,
	"interest_yoga" smallint,
	"pref_attr" real,
	"pref_sinc" real,
	"pref_intel" real,
	"pref_fun" real,
	"pref_amb" real,
	"pref_shar" real,
	"self_attr" smallint,
	"self_sinc" smallint,
	"self_intel" smallint,
	"self_fun" smallint,
	"self_amb" smallint,
	"self_shar" smallint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_a_user_profiles_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_b_user_profiles_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_a_user_profiles_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_b_user_profiles_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_candidate_id_user_profiles_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_embeddings" ADD CONSTRAINT "user_embeddings_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friendships_user_b_idx" ON "friendships" USING btree ("user_b");--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_pair_uniq" ON "interactions" USING btree ("user_a","user_b");--> statement-breakpoint
CREATE INDEX "interactions_user_a_idx" ON "interactions" USING btree ("user_a");--> statement-breakpoint
CREATE INDEX "interactions_user_b_idx" ON "interactions" USING btree ("user_b");--> statement-breakpoint
CREATE INDEX "interactions_match_idx" ON "interactions" USING btree ("match");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendations_user_candidate_uniq" ON "recommendations" USING btree ("user_id","candidate_id");--> statement-breakpoint
CREATE INDEX "recommendations_user_id_idx" ON "recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendations_candidate_id_idx" ON "recommendations" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "user_embeddings_bio_hnsw" ON "user_embeddings" USING hnsw ("bio" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profiles_synthetic_idx" ON "user_profiles" USING btree ("is_synthetic");--> statement-breakpoint
CREATE INDEX "user_profiles_lat_lon_idx" ON "user_profiles" USING btree ("latitude","longitude");
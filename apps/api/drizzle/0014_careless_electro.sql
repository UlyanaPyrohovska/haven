CREATE TABLE "crossings" (
	"user_a" integer NOT NULL,
	"user_b" integer NOT NULL,
	"count" smallint DEFAULT 0 NOT NULL,
	"last_crossed_at" timestamp,
	"last_place" varchar(200),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crossings_user_a_user_b_pk" PRIMARY KEY("user_a","user_b")
);
--> statement-breakpoint
ALTER TABLE "crossings" ADD CONSTRAINT "crossings_user_a_user_profiles_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crossings" ADD CONSTRAINT "crossings_user_b_user_profiles_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crossings_user_b_idx" ON "crossings" USING btree ("user_b");
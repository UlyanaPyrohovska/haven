CREATE TABLE "custom_interests" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(30) NOT NULL,
	"key" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "custom_interests" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_interests_key_idx" ON "custom_interests" USING btree ("key");

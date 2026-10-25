CREATE TABLE "matching_config" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"batch_size" smallint NOT NULL,
	"cooldown_hours" real NOT NULL,
	"weight_bio" real NOT NULL,
	"weight_interest" real NOT NULL,
	"weight_geo" real NOT NULL,
	"weight_pref" real NOT NULL,
	"cross_paths_lambda" real NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "daily_question_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_profile_id" integer NOT NULL,
	"answer" varchar(500) NOT NULL,
	"answer_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "daily_question_answers" ADD CONSTRAINT "daily_question_answers_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "daily_question_answers_profile_date_uniq" ON "daily_question_answers" USING btree ("user_profile_id","answer_date");

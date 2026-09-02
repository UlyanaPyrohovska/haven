import { z } from "@hono/zod-openapi";
import { ageFromBirthDate, MAX_AGE, MIN_AGE, parseIsoDate } from "@/lib/age";

/** `interest_*` and `self_*` columns are 1–10 Likert values; null means "not answered". */
const likert = z.number().int().min(1).max(10).nullable().optional();

/**
 * `birth_date` is a `YYYY-MM-DD` string. The 18+ rule is enforced here so a tampered
 * client can't bypass the age gate in the app.
 */
const birthDate = z
	.string()
	.superRefine((value, ctx) => {
		const parsed = parseIsoDate(value);

		if (!parsed) {
			ctx.addIssue({ code: "custom", message: "Expected a valid YYYY-MM-DD date." });
			return;
		}

		const age = ageFromBirthDate(parsed);

		if (age < MIN_AGE) {
			ctx.addIssue({ code: "custom", message: `Haven is only available from age ${MIN_AGE}.` });
		}

		if (age > MAX_AGE) {
			ctx.addIssue({ code: "custom", message: "That date of birth is out of range." });
		}
	})
	.nullable()
	.optional();

/** `pref_*` columns hold one share of a 100-point split across the trait dimensions. */
const points = z.number().min(0).max(100).optional();

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const ProfileUpdateSchema = z
	.object({
		birthDate,
		gender: z.number().int().min(0).max(1).nullable().optional(),
		career: nullableText(100),
		goal: nullableText(100),
		bio: nullableText(2000),

		interestSports: likert,
		interestTvsports: likert,
		interestExercise: likert,
		interestDining: likert,
		interestMuseums: likert,
		interestArt: likert,
		interestHiking: likert,
		interestGaming: likert,
		interestClubbing: likert,
		interestReading: likert,
		interestTv: likert,
		interestTheater: likert,
		interestMovies: likert,
		interestConcerts: likert,
		interestMusic: likert,
		interestShopping: likert,
		interestYoga: likert,

		prefAttr: points,
		prefSinc: points,
		prefIntel: points,
		prefFun: points,
		prefAmb: points,
		prefShar: points,

		selfAttr: likert,
		selfSinc: likert,
		selfIntel: likert,
		selfFun: likert,
		selfAmb: likert,
		selfShar: likert,
	})
	.openapi("ProfileUpdate");

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("Error");

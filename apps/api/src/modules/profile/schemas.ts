import { z } from "@hono/zod-openapi";
import { ageFromBirthDate, MAX_AGE, MIN_AGE, parseIsoDate } from "@/lib/age";
import {
	DatingGoals,
	FriendsGoals,
	isGoalValidForLookingFor,
	LookingFor,
	type LookingForValue,
	ProfileGoals,
} from "@/lib/looking-for";

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

/** Distinct values from the synthetic dataset; kept in sync with mobile `EthnicityOptions`. */
const ethnicityValues = [
	"Asian/Pacific Islander",
	"Black/African American",
	"European/Caucasian-American",
	"Latino/Hispanic American",
	"Native American",
	"Other",
] as const;

const lookingFor = z.union([z.literal(LookingFor.friends), z.literal(LookingFor.dating)]).optional();

const goal = z.enum(ProfileGoals).nullable().optional();

const privacyToggle = z.boolean().optional();

export const ProfileUpdateSchema = z
	.object({
		birthDate,
		gender: z.number().int().min(0).max(1).nullable().optional(),
		ethnicity: z.enum(ethnicityValues).nullable().optional(),
		career: nullableText(100),
		lookingFor,
		goal,
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

		discoverable: privacyToggle,
		showAge: privacyToggle,
		showCareer: privacyToggle,
		showBio: privacyToggle,
		showInterests: privacyToggle,
		shareLocation: privacyToggle,
		shareCrossPaths: privacyToggle,
		locationHidden: privacyToggle,
		displayLocation: nullableText(200),
		latitude: z.number().min(-90).max(90).nullable().optional(),
		longitude: z.number().min(-180).max(180).nullable().optional(),
	})
	.superRefine((value, ctx) => {
		if (value.lookingFor === undefined || value.goal == null) {
			return;
		}

		if (!isGoalValidForLookingFor(value.goal, value.lookingFor as LookingForValue)) {
			const allowed = value.lookingFor === LookingFor.dating ? DatingGoals : FriendsGoals;

			ctx.addIssue({
				code: "custom",
				path: ["goal"],
				message: `Goal must match lookingFor. Expected one of: ${allowed.join(", ")}`,
			});
		}
	})
	.openapi("ProfileUpdate");

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("Error");

export const ProfileResponseSchema = z
	.object({
		profile: z.record(z.string(), z.unknown()).nullable(),
	})
	.openapi("ProfileResponse");

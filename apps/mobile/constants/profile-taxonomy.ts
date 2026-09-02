/**
 * Onboarding option sets, mapped 1:1 onto `user_profiles` columns in the API schema.
 * Keys here are the Drizzle field names so the submitted payload needs no translation layer.
 */

/** Lowest and highest value accepted by the `interest_*` and `self_*` Likert columns. */
export const LIKERT_MIN = 1;
export const LIKERT_MAX = 10;

/** `pref_*` columns hold a 100-point split across the six dimensions, as in the seed dataset. */
export const PARTNER_BUDGET = 100;

/**
 * Partner importance and self-ratings are both captured on this drag scale. Partner values
 * are normalised into `PARTNER_BUDGET` on submit; self-ratings map straight to `self_*`.
 */
export const IMPORTANCE_MIN = LIKERT_MIN;
export const IMPORTANCE_MAX = LIKERT_MAX;

export const BIO_MAX_LENGTH = 500;

/**
 * Interests are collected as a pick-list rather than 17 separate ratings, so the Likert
 * columns receive one of these two values. Every column is written, which keeps the
 * vectors dense for interest-overlap scoring.
 */
export const INTEREST_SELECTED = LIKERT_MAX;
export const INTEREST_UNSELECTED = LIKERT_MIN;

/** Interests a user must pick before continuing, so the ranker has some signal. */
export const MIN_SELECTED_INTERESTS = 5;

/** `gender` is a smallint in the schema: 0 = female, 1 = male. */
export const GenderOptions = [
	{ value: 0, label: "Woman" },
	{ value: 1, label: "Man" },
] as const;

export type GenderValue = (typeof GenderOptions)[number]["value"];

/** `goal` is free-text varchar(100); these are the values the app offers. */
export const GoalOptions = [
	"Make new friends",
	"Find a relationship",
	"Meet people nearby",
	"Share a hobby",
	"Something casual",
] as const;

export type GoalValue = (typeof GoalOptions)[number];

/** The 17 `interest_*` columns, grouped only to break up the pick-list visually. */
export const InterestCategories = [
	{
		key: "active",
		label: "Sport & movement",
		interests: [
			{ key: "interestSports", label: "Playing sports" },
			{ key: "interestTvsports", label: "Watching sports" },
			{ key: "interestExercise", label: "Exercise" },
			{ key: "interestHiking", label: "Hiking" },
			{ key: "interestYoga", label: "Yoga" },
		],
	},
	{
		key: "culture",
		label: "Arts & culture",
		interests: [
			{ key: "interestMuseums", label: "Museums" },
			{ key: "interestArt", label: "Art" },
			{ key: "interestTheater", label: "Theatre" },
			{ key: "interestReading", label: "Reading" },
		],
	},
	{
		key: "screens",
		label: "Music & screens",
		interests: [
			{ key: "interestMusic", label: "Music" },
			{ key: "interestConcerts", label: "Concerts" },
			{ key: "interestMovies", label: "Movies" },
			{ key: "interestTv", label: "TV" },
			{ key: "interestGaming", label: "Gaming" },
		],
	},
	{
		key: "social",
		label: "Going out",
		interests: [
			{ key: "interestDining", label: "Dining out" },
			{ key: "interestClubbing", label: "Clubbing" },
			{ key: "interestShopping", label: "Shopping" },
		],
	},
] as const;

export type InterestKey = (typeof InterestCategories)[number]["interests"][number]["key"];

export type InterestField = {
	key: InterestKey;
	label: string;
};

/** Flat view of every interest column, for building the submit payload. */
export const InterestFields: readonly InterestField[] = InterestCategories.flatMap<InterestField>((category) => [
	...category.interests,
]);

/**
 * The six shared dimensions behind the `pref_*` (what you want in others) and
 * `self_*` (how you rate yourself) column groups. "Shared interests" is only
 * answerable about a partner, so it is excluded from the self-rating step.
 */
export const TraitDimensions = [
	{ key: "attr", label: "Attractiveness", prefKey: "prefAttr", selfKey: "selfAttr", selfRated: true },
	{ key: "sinc", label: "Sincerity", prefKey: "prefSinc", selfKey: "selfSinc", selfRated: true },
	{ key: "intel", label: "Intelligence", prefKey: "prefIntel", selfKey: "selfIntel", selfRated: true },
	{ key: "fun", label: "Fun", prefKey: "prefFun", selfKey: "selfFun", selfRated: true },
	{ key: "amb", label: "Ambition", prefKey: "prefAmb", selfKey: "selfAmb", selfRated: true },
	{ key: "shar", label: "Shared interests", prefKey: "prefShar", selfKey: "selfShar", selfRated: false },
] as const;

export type TraitDimension = (typeof TraitDimensions)[number];

/** Dimensions shown on the self-rating step; `self_shar` is left null. */
export const SelfDimensions = TraitDimensions.filter(
	(dimension): dimension is Extract<TraitDimension, { selfRated: true }> => dimension.selfRated,
);

export type TraitKey = TraitDimension["key"];
export type PrefKey = TraitDimension["prefKey"];
export type SelfKey = (typeof SelfDimensions)[number]["selfKey"];

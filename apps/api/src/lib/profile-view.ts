import { ageFromBirthDate, parseIsoDate } from "@/lib/age";

/** Interest columns on `user_profiles`, matching mobile `InterestFields`. */
export const INTEREST_KEYS = [
	"interestSports",
	"interestTvsports",
	"interestExercise",
	"interestDining",
	"interestMuseums",
	"interestArt",
	"interestHiking",
	"interestGaming",
	"interestClubbing",
	"interestReading",
	"interestTv",
	"interestTheater",
	"interestMovies",
	"interestConcerts",
	"interestMusic",
	"interestShopping",
	"interestYoga",
] as const;

export type InterestKey = (typeof INTEREST_KEYS)[number];

export const INTEREST_LABELS: Record<InterestKey, string> = {
	interestSports: "Sports",
	interestTvsports: "TV sports",
	interestExercise: "Exercise",
	interestDining: "Dining",
	interestMuseums: "Museums",
	interestArt: "Art",
	interestHiking: "Hiking",
	interestGaming: "Gaming",
	interestClubbing: "Clubbing",
	interestReading: "Reading",
	interestTv: "TV",
	interestTheater: "Theatre",
	interestMovies: "Movies",
	interestConcerts: "Concerts",
	interestMusic: "Music",
	interestShopping: "Shopping",
	interestYoga: "Yoga",
};

/** Synthetic rows use the full Likert range; real onboarding writes 10/1. */
const INTEREST_ACTIVE_THRESHOLD = 8;

export type ProfileRow = Record<string, unknown>;

export function profileAge(birthDate: unknown): number | undefined {
	if (typeof birthDate !== "string") {
		return undefined;
	}

	const parsed = parseIsoDate(birthDate);

	return parsed ? ageFromBirthDate(parsed) : undefined;
}

export function ageLabel(age: number): string {
	if (age < 20) {
		return "late teens";
	}

	if (age < 25) {
		return "early 20s";
	}

	if (age < 30) {
		return "mid-20s";
	}

	if (age < 35) {
		return "early 30s";
	}

	if (age < 40) {
		return "late 30s";
	}

	return `${age}`;
}

export function selectedInterestKeys(profile: ProfileRow): InterestKey[] {
	return INTEREST_KEYS.filter((key) => {
		const value = profile[key];

		return typeof value === "number" && value >= INTEREST_ACTIVE_THRESHOLD;
	});
}

export function interestLabels(profile: ProfileRow): string[] {
	return selectedInterestKeys(profile).map((key) => INTEREST_LABELS[key]);
}

export function sharedInterestLabels(viewer: ProfileRow, candidate: ProfileRow): string[] {
	const viewerKeys = new Set(selectedInterestKeys(viewer));

	return selectedInterestKeys(candidate)
		.filter((key) => viewerKeys.has(key))
		.map((key) => INTEREST_LABELS[key]);
}

export function haversineKm(
	latA: number | null | undefined,
	lonA: number | null | undefined,
	latB: number | null | undefined,
	lonB: number | null | undefined,
): number | undefined {
	if (latA == null || lonA == null || latB == null || lonB == null) {
		return undefined;
	}

	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(latB - latA);
	const dLon = toRad(lonB - lonA);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;

	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

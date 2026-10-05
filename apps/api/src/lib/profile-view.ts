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

const PREF_KEYS = ["prefAttr", "prefSinc", "prefIntel", "prefFun", "prefAmb", "prefShar"] as const;
/** Self-ratings collected in onboarding; `selfShar` is pref-only and stays null for real users. */
const SELF_RATED_KEYS = ["selfAttr", "selfSinc", "selfIntel", "selfFun", "selfAmb"] as const;

/** True when onboarding fields needed for compatibility scoring are present. */
export function isProfileComplete(profile: ProfileRow): boolean {
	const hasInterest = INTEREST_KEYS.some((key) => profile[key] != null);
	const hasPref = PREF_KEYS.every((key) => typeof profile[key] === "number");
	const hasSelf = SELF_RATED_KEYS.every((key) => typeof profile[key] === "number");

	return hasInterest && hasPref && hasSelf;
}

export type PrivacySettings = {
	discoverable: boolean;
	showAge: boolean;
	showCareer: boolean;
	showBio: boolean;
	showInterests: boolean;
	shareLocation: boolean;
	shareCrossPaths: boolean;
};

export type LocationSettings = {
	displayLocation: string | null;
	locationHidden: boolean;
	shareLocation: boolean;
	shareCrossPaths: boolean;
};

export const PRIVACY_KEYS = [
	"discoverable",
	"showAge",
	"showCareer",
	"showBio",
	"showInterests",
	"shareLocation",
	"shareCrossPaths",
] as const satisfies readonly (keyof PrivacySettings)[];

function readPrivacyFlag(profile: ProfileRow, key: keyof PrivacySettings): boolean {
	return profile[key] !== false;
}

export function readPrivacySettings(profile: ProfileRow): PrivacySettings {
	return {
		discoverable: readPrivacyFlag(profile, "discoverable"),
		showAge: readPrivacyFlag(profile, "showAge"),
		showCareer: readPrivacyFlag(profile, "showCareer"),
		showBio: readPrivacyFlag(profile, "showBio"),
		showInterests: readPrivacyFlag(profile, "showInterests"),
		shareLocation: readPrivacyFlag(profile, "shareLocation"),
		shareCrossPaths: readPrivacyFlag(profile, "shareCrossPaths"),
	};
}

function readDisplayLocation(profile: ProfileRow): string | null {
	if (typeof profile.displayLocation !== "string") {
		return null;
	}

	const trimmed = profile.displayLocation.trim();

	return trimmed.length > 0 ? trimmed : null;
}

export function readLocationSettings(profile: ProfileRow): LocationSettings {
	return {
		displayLocation: readDisplayLocation(profile),
		locationHidden: profile.locationHidden === true,
		shareLocation: readPrivacyFlag(profile, "shareLocation"),
		shareCrossPaths: readPrivacyFlag(profile, "shareCrossPaths"),
	};
}

export function shouldShowCrossPaths(viewer: ProfileRow, candidate: ProfileRow): boolean {
	return readPrivacySettings(viewer).shareCrossPaths && readPrivacySettings(candidate).shareCrossPaths;
}

export function candidateLocationLabel(viewer: ProfileRow, candidate: ProfileRow): string | undefined {
	if (!readPrivacySettings(candidate).shareLocation) {
		return undefined;
	}

	const displayLocation = readDisplayLocation(candidate);

	if (displayLocation) {
		return displayLocation;
	}

	const distance = haversineKm(
		viewer.latitude as number | null,
		viewer.longitude as number | null,
		candidate.latitude as number | null,
		candidate.longitude as number | null,
	);

	if (distance === undefined) {
		return undefined;
	}

	if (distance < 5) {
		return "Setúbal, Portugal";
	}

	return `${distance.toFixed(0)} km away`;
}

export type PublicProfileFields = {
	ageLabel?: string;
	career: string | null;
	bio: string | null;
	interests: string[];
	topInterests: string[];
	sharedInterests: string[];
};

/** Applies a profile owner's privacy toggles to fields shown to other users. */
export function publicProfileFields(
	viewer: ProfileRow,
	candidate: ProfileRow,
): PublicProfileFields {
	const privacy = readPrivacySettings(candidate);
	const age = profileAge(candidate.birthDate);
	const interests = privacy.showInterests ? interestLabels(candidate) : [];
	const shared = privacy.showInterests ? sharedInterestLabels(viewer, candidate) : [];

	return {
		ageLabel: privacy.showAge && age !== undefined ? ageLabel(age) : undefined,
		career: privacy.showCareer && typeof candidate.career === "string" ? candidate.career : null,
		bio: privacy.showBio && typeof candidate.bio === "string" ? candidate.bio : null,
		interests,
		topInterests: interests.slice(0, 3),
		sharedInterests: shared.length > 0 ? shared.slice(0, 6) : interests.slice(0, 3),
	};
}

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

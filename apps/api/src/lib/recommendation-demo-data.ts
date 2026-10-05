import { hashIndex } from "@/lib/avatar-url";

/** Presentation extras for demo recommendation candidates (synthetic profile ids). */
export type DemoCandidatePresentation = {
	displayName: string;
	crossPathsCount: number;
};

export type CandidateDisplayProfile = {
	id: number;
	gender?: number | null;
	isSynthetic?: boolean;
};

/** First names for seeded synthetic profiles (no name column in the CSV). */
const FEMALE_FIRST_NAMES = [
	"Anna",
	"Maya",
	"Sofia",
	"Inês",
	"Beatriz",
	"Mariana",
	"Clara",
	"Leonor",
	"Matilde",
	"Rita",
	"Carolina",
	"Joana",
	"Laura",
	"Teresa",
	"Helena",
] as const;

const MALE_FIRST_NAMES = [
	"Leo",
	"Tiago",
	"Miguel",
	"Duarte",
	"Francisco",
	"Gonçalo",
	"Pedro",
	"Rafael",
	"Tomás",
	"Diogo",
	"André",
	"Luís",
	"Daniel",
	"Bruno",
	"Ricardo",
] as const;

/** Curated to match the connection-detail mockup and nearby Setúbal profiles. */
export const DEMO_CANDIDATE_PRESENTATION: Record<number, DemoCandidatePresentation> = {
	298: {
		displayName: "Anna",
		crossPathsCount: 3,
	},
	335: {
		displayName: "Maya",
		crossPathsCount: 2,
	},
	556: {
		displayName: "Sofia",
		crossPathsCount: 4,
	},
	401: {
		displayName: "Leo",
		crossPathsCount: 1,
	},
	513: {
		displayName: "Inês",
		crossPathsCount: 2,
	},
};

export const DEMO_CANDIDATE_IDS = Object.keys(DEMO_CANDIDATE_PRESENTATION).map(Number);

export function demoPresentation(candidateId: number): DemoCandidatePresentation | undefined {
	return DEMO_CANDIDATE_PRESENTATION[candidateId];
}

function syntheticFirstName(profile: CandidateDisplayProfile): string {
	const pool = profile.gender === 1 ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;

	return pool[hashIndex(profile.id, pool.length)];
}

export function displayNameForCandidate(profile: CandidateDisplayProfile, fallback = "Someone"): string {
	const curated = DEMO_CANDIDATE_PRESENTATION[profile.id]?.displayName;

	if (curated) {
		return curated;
	}

	if (profile.isSynthetic !== false) {
		return syntheticFirstName(profile);
	}

	return fallback;
}

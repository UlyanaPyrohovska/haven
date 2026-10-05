import { hashIndex } from "@/lib/avatar-url";

export type CandidateDisplayProfile = {
	id: number;
	displayName?: string | null;
	gender?: number | null;
	isSynthetic?: boolean;
};

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

/** Deterministic first name for synthetic profiles (used in seed and as a read fallback). */
export function syntheticDisplayName(profile: Pick<CandidateDisplayProfile, "id" | "gender">): string {
	const pool = profile.gender === 1 ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;

	return pool[hashIndex(profile.id, pool.length)];
}

export function displayNameFromAuthName(name: string | null | undefined): string | null {
	const token = name?.trim().split(/\s+/)[0];

	if (!token) {
		return null;
	}

	return token.slice(0, 80);
}

export function displayNameForCandidate(profile: CandidateDisplayProfile, fallback = "Someone"): string {
	const stored = profile.displayName?.trim();

	if (stored) {
		return stored;
	}

	if (profile.isSynthetic !== false) {
		return syntheticDisplayName(profile);
	}

	return fallback;
}

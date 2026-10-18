import { haversineKm } from "@/lib/profile-view";

export type ScoringProfile = {
	id: number;
	interests: (number | null)[];
	/** Lower-cased custom interest labels; each one is an extra binary interest dimension. */
	customInterests?: readonly string[];
	pref: (number | null)[];
	self: (number | null)[];
	latitude: number | null;
	longitude: number | null;
	bioEmbedding: number[] | null;
};

export type ScoringWeights = {
	bio: number;
	interest: number;
	geo: number;
	pref: number;
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
	bio: 0.35,
	interest: 0.3,
	geo: 0.2,
	pref: 0.15,
};

/** Daily-drop feed: small batch size and cooldown between batches (hours). */
export const CADENCE = {
	batchSize: 4,
	cooldownHours: 24,
} as const;

/** "Crossed paths" re-rank: boost strength (keep ≤ 0.25 so it doesn't double-count geo) and saturation scale. */
export const CROSS_PATHS = {
	lambda: 0.2,
	K: 3,
} as const;

/** Distance decay scale for `geoProximity` (km). */
export const GEO_DECAY_TAU_KM = 25;

const INTEREST_DIM = 17;
const TRAIT_DIM = 6;
const INTEREST_NEUTRAL = 5;
/** Custom interests mirror the 10/1 values onboarding writes for picked/unpicked fixed interests. */
const CUSTOM_INTEREST_ON = 10;
const CUSTOM_INTEREST_OFF = 1;
const SELF_NEUTRAL = 5;
/** Equal share of the 100-point preference split. */
const PREF_NEUTRAL = 100 / TRAIT_DIM;

function fillDim(values: readonly (number | null | undefined)[], length: number, neutral: number): number[] {
	const out = new Array<number>(length);

	for (let i = 0; i < length; i++) {
		const v = values[i];
		out[i] = v == null ? neutral : v;
	}

	return out;
}

function vectorNorm(values: readonly number[]): number {
	let sum = 0;

	for (const v of values) {
		sum += v * v;
	}

	return Math.sqrt(sum);
}

function dot(a: readonly number[], b: readonly number[]): number {
	let sum = 0;

	for (let i = 0; i < a.length; i++) {
		sum += a[i] * b[i];
	}

	return sum;
}

/** Cosine in [-1, 1]; returns 0 when either vector has zero norm. */
function rawCosine(a: readonly number[], b: readonly number[]): number {
	const normA = vectorNorm(a);
	const normB = vectorNorm(b);

	if (normA === 0 || normB === 0) {
		return 0;
	}

	return dot(a, b) / (normA * normB);
}

function clampUnitInterval(value: number): number {
	if (value <= 0) {
		return 0;
	}

	if (value >= 1) {
		return 1;
	}

	return value;
}

/**
 * Cosine over the 17 fixed interests plus one dimension per custom interest either side holds.
 * With no custom interests on either side this is the plain 17-dim cosine.
 */
export function interestSimilarity(
	a: readonly (number | null | undefined)[],
	b: readonly (number | null | undefined)[],
	customA: readonly string[] = [],
	customB: readonly string[] = [],
): number {
	const va = fillDim(a, INTEREST_DIM, INTEREST_NEUTRAL);
	const vb = fillDim(b, INTEREST_DIM, INTEREST_NEUTRAL);
	const setA = new Set(customA);
	const setB = new Set(customB);

	for (const label of new Set([...setA, ...setB])) {
		va.push(setA.has(label) ? CUSTOM_INTEREST_ON : CUSTOM_INTEREST_OFF);
		vb.push(setB.has(label) ? CUSTOM_INTEREST_ON : CUSTOM_INTEREST_OFF);
	}

	return clampUnitInterval(rawCosine(va, vb));
}

export function preferenceMatch(
	fromPref: readonly (number | null | undefined)[],
	toSelf: readonly (number | null | undefined)[],
): number {
	const pref = fillDim(fromPref, TRAIT_DIM, PREF_NEUTRAL);
	const self = fillDim(toSelf, TRAIT_DIM, SELF_NEUTRAL);

	return clampUnitInterval(rawCosine(pref, self));
}

export function geoProximity(
	a: Pick<ScoringProfile, "latitude" | "longitude">,
	b: Pick<ScoringProfile, "latitude" | "longitude">,
	tauKm: number = GEO_DECAY_TAU_KM,
): number {
	const distanceKm = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);

	if (distanceKm === undefined) {
		return 0.5;
	}

	return clampUnitInterval(Math.exp(-distanceKm / tauKm));
}

export function bioSimilarity(a: number[] | null | undefined, b: number[] | null | undefined): number | null {
	if (a == null || b == null || a.length === 0 || b.length === 0) {
		return null;
	}

	return clampUnitInterval(rawCosine(a, b));
}

export function unilateral(u: ScoringProfile, v: ScoringProfile, w: ScoringWeights = DEFAULT_WEIGHTS): number {
	const interest = interestSimilarity(u.interests, v.interests, u.customInterests, v.customInterests);
	const geo = geoProximity(u, v);
	const pref = preferenceMatch(u.pref, v.self);
	const bio = bioSimilarity(u.bioEmbedding, v.bioEmbedding);

	if (bio === null) {
		const renorm = w.interest + w.geo + w.pref;

		if (renorm === 0) {
			return 0;
		}

		return clampUnitInterval((w.interest * interest + w.geo * geo + w.pref * pref) / renorm);
	}

	return clampUnitInterval(w.bio * bio + w.interest * interest + w.geo * geo + w.pref * pref);
}

export type ReciprocalScoreResult = {
	reciprocal: number;
	pUToV: number;
	qVToU: number;
};

export function reciprocalScore(
	u: ScoringProfile,
	v: ScoringProfile,
	w: ScoringWeights = DEFAULT_WEIGHTS,
): ReciprocalScoreResult {
	const pUToV = unilateral(u, v, w);
	const qVToU = unilateral(v, u, w);
	const sum = pUToV + qVToU;
	const reciprocal = sum === 0 ? 0 : (2 * pUToV * qVToU) / sum;

	return { reciprocal, pUToV, qVToU };
}

/** Saturating crossing-count norm in [0, 1): norm(3) ≈ 0.63 with the default K. */
export function crossPathsNorm(count: number, K: number = CROSS_PATHS.K): number {
	return count > 0 ? 1 - Math.exp(-count / K) : 0;
}

/** Symmetric serendipity nudge applied once to the reciprocal score (not inside `unilateral`). */
export function applyCrossPathsBoost(reciprocal: number, count: number, lambda: number = CROSS_PATHS.lambda): number {
	return reciprocal * (1 + lambda * crossPathsNorm(count));
}

import type { MoodSlug } from "@/lib/mood";
import { haversineKm } from "@/lib/profile-view";

export type ScoringProfile = {
	id: number;
	interests: (number | null)[];
	/** Lower-cased custom interest labels; each one is an extra binary interest dimension. */
	customInterests?: readonly string[];
	pref: (number | null)[];
	/** Taste learned from likes and passes (a centered trait direction), see `preference-learning.ts`. */
	learnedPref?: readonly number[] | null;
	/** Share of the preference term `learnedPref` takes, already shrunk for few or weak decisions. */
	learnedShare?: number;
	self: (number | null)[];
	latitude: number | null;
	longitude: number | null;
	bioEmbedding: number[] | null;
	/** Today's mood check-in; null when the user has not checked in today. */
	mood?: MoodSlug | null;
	/** Today's daily-question answer; null when the user has not answered today. */
	dailyAnswer?: string | null;
};

export type ScoringWeights = {
	bio: number;
	interest: number;
	geo: number;
	pref: number;
	mood: number;
	dailyAnswer: number;
};

export const DEFAULT_WEIGHTS: ScoringWeights = {
	bio: 0.3,
	interest: 0.25,
	geo: 0.15,
	pref: 0.15,
	mood: 0.05,
	dailyAnswer: 0.1,
};

/** Daily-drop feed: small batch size and cooldown between batches (hours). */
export const CADENCE = {
	batchSize: 4,
	cooldownHours: 24,
} as const;

/**
 * "Crossed paths" re-rank: boost strength in σ of standardized score (the boost approaches it as crossings grow;
 * keep ≤ 0.5 so it doesn't double-count geo) and saturation scale.
 */
export const CROSS_PATHS = {
	lambda: 0.5,
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

/**
 * Pearson correlation mapped to [0, 1]: compares which dimensions stand out on each side, not their level.
 * 0.5 means no signal, including when either side is flat (all neutral or all equal).
 */
function centeredSimilarity(a: readonly number[], b: readonly number[]): number {
	const meanA = a.reduce((sum, v) => sum + v, 0) / a.length;
	const meanB = b.reduce((sum, v) => sum + v, 0) / b.length;

	return (
		(rawCosine(
			a.map((v) => v - meanA),
			b.map((v) => v - meanB),
		) +
			1) /
		2
	);
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
 * Centered similarity over the 17 fixed interests plus one dimension per custom interest either side holds.
 * Centering keeps an empty (all-neutral) profile at 0.5 instead of above a real partial overlap.
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

	return centeredSimilarity(va, vb);
}

/**
 * Whether `toSelf`'s relative strengths line up with what `fromPref` weights most. Centering the self-ratings
 * makes it immune to rating yourself high on everything; a flat preference or flat self-rating gives 0.5.
 */
export function preferenceMatch(
	fromPref: readonly (number | null | undefined)[],
	toSelf: readonly (number | null | undefined)[],
): number {
	const pref = fillDim(fromPref, TRAIT_DIM, PREF_NEUTRAL);
	const self = fillDim(toSelf, TRAIT_DIM, SELF_NEUTRAL);

	return centeredSimilarity(pref, self);
}

/**
 * u's preference term toward v: the stated fit blended in score space with u's learned taste. Blending the
 * scores, not the vectors, keeps a weak learned signal weak: a flat stated split scores 0.5 and stays near it.
 */
export function directedPreferenceMatch(
	u: Pick<ScoringProfile, "pref" | "learnedPref" | "learnedShare">,
	v: Pick<ScoringProfile, "self">,
): number {
	const stated = preferenceMatch(u.pref, v.self);
	const share = u.learnedPref ? (u.learnedShare ?? 0) : 0;

	return share > 0 && u.learnedPref ? (1 - share) * stated + share * preferenceMatch(u.learnedPref, v.self) : stated;
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

/**
 * How well two moods sit together today, symmetric, in [0, 1]. 0.5 is neutral: calm pairs well
 * with anything, two low or stressed people are a weak pairing.
 */
const MOOD_COMPAT: Record<MoodSlug, Record<MoodSlug, number>> = {
	happy: { happy: 0.8, calm: 0.7, excited: 0.8, tired: 0.5, low: 0.4, stressed: 0.4 },
	calm: { happy: 0.7, calm: 0.7, excited: 0.5, tired: 0.7, low: 0.6, stressed: 0.7 },
	excited: { happy: 0.8, calm: 0.5, excited: 0.8, tired: 0.3, low: 0.3, stressed: 0.4 },
	tired: { happy: 0.5, calm: 0.7, excited: 0.3, tired: 0.5, low: 0.4, stressed: 0.4 },
	low: { happy: 0.4, calm: 0.6, excited: 0.3, tired: 0.4, low: 0.2, stressed: 0.3 },
	stressed: { happy: 0.4, calm: 0.7, excited: 0.4, tired: 0.4, low: 0.3, stressed: 0.3 },
};

export function moodCompatibility(a: MoodSlug | null | undefined, b: MoodSlug | null | undefined): number | null {
	if (a == null || b == null) {
		return null;
	}

	return MOOD_COMPAT[a][b];
}

// Words of 1-2 letters are dropped by length, so only longer filler is listed.
const ANSWER_STOPWORDS = new Set([
	"the",
	"and",
	"for",
	"with",
	"that",
	"this",
	"was",
	"were",
	"are",
	"you",
	"your",
	"our",
	"but",
	"not",
	"have",
	"had",
	"has",
	"from",
	"about",
	"just",
	"into",
	"out",
	"its",
	"it's",
	"i'm",
	"i've",
	"she",
	"they",
	"them",
	"what",
	"when",
	"who",
	"how",
	"all",
	"one",
	"some",
	"very",
	"really",
	"finally",
	"after",
	"before",
]);

function answerTokens(text: string): Set<string> {
	const words = text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

	return new Set(words.filter((word) => word.length > 2 && !ANSWER_STOPWORDS.has(word)));
}

/**
 * Word overlap between today's two answers, mapped to [0.5, 1] so no overlap is neutral, not a penalty.
 * shortcut: lexical Jaccard, not semantic; switch to embedding cosine once T9 adds Workers AI embeddings.
 */
export function dailyAnswerSimilarity(a: string | null | undefined, b: string | null | undefined): number | null {
	const tokensA = answerTokens(a ?? "");
	const tokensB = answerTokens(b ?? "");

	if (tokensA.size === 0 || tokensB.size === 0) {
		return null;
	}

	let shared = 0;

	for (const token of tokensA) {
		if (tokensB.has(token)) {
			shared++;
		}
	}

	return 0.5 + (0.5 * shared) / (tokensA.size + tokensB.size - shared);
}

export type ComponentCalibration = Record<keyof ScoringWeights, { mean: number; sd: number }>;

/**
 * Population mean and spread of each component over random same-pool pairs, so a weight means the same
 * influence for every component. Measured on the dev DB (2026-10-29, ~10k pairs, mostly synthetic
 * profiles). Refresh with `pnpm --filter api db:component-stats` after the population changes.
 */
export const COMPONENT_CALIBRATION: ComponentCalibration = {
	interest: { mean: 0.605, sd: 0.119 },
	geo: { mean: 0.594, sd: 0.152 },
	pref: { mean: 0.495, sd: 0.22 },
	bio: { mean: 0.462, sd: 0.107 },
	mood: { mean: 0.5, sd: 0.177 },
	dailyAnswer: { mean: 0.512, sd: 0.07 },
};

/** z-scores are clipped here: calibration equalizes spread, not tails, so a rare perfect match (identical answers sit ~7σ out) can't outweigh the rest. */
const Z_CLIP = 3;

/** Neutral point of the context terms: the mood table's neutral, and an answer with no shared words. */
const CONTEXT_NEUTRAL = 0.5;

/**
 * Calibrated one-way score: each component as a z-score against `calibration`, weighted, standardized by
 * `sqrt(Σ w²)` (unit spread for independent terms) and squashed to (0, 1). A missing component is z = 0, so
 * missing data is exactly neutral. Mood and daily answer only lift (`max(0, z)`), so checking in or answering
 * never costs a score that skipping would keep, and a low mood is a disclosure, not a penalty.
 * `calibration = null` is the uncalibrated formula (thesis ablation).
 */
export function unilateral(
	u: ScoringProfile,
	v: ScoringProfile,
	w: ScoringWeights = DEFAULT_WEIGHTS,
	calibration: ComponentCalibration | null = COMPONENT_CALIBRATION,
): number {
	if (!calibration) {
		return uncalibratedUnilateral(u, v, w);
	}

	const z = (key: keyof ScoringWeights, value: number | null) => {
		const { mean, sd } = calibration[key];

		return value === null || sd <= 0 ? 0 : Math.max(-Z_CLIP, Math.min(Z_CLIP, (value - mean) / sd));
	};
	const terms: [number, number][] = [
		[w.interest, z("interest", interestSimilarity(u.interests, v.interests, u.customInterests, v.customInterests))],
		[w.geo, z("geo", geoProximity(u, v))],
		[w.pref, z("pref", directedPreferenceMatch(u, v))],
		[w.bio, z("bio", bioSimilarity(u.bioEmbedding, v.bioEmbedding))],
		[w.mood, Math.max(0, z("mood", moodCompatibility(u.mood, v.mood)))],
		[w.dailyAnswer, Math.max(0, z("dailyAnswer", dailyAnswerSimilarity(u.dailyAnswer, v.dailyAnswer)))],
	];
	const norm = Math.sqrt(terms.reduce((sum, [weight]) => sum + weight * weight, 0));

	if (norm === 0) {
		return 0;
	}

	const standardized = terms.reduce((sum, [weight, value]) => sum + weight * value, 0) / norm;

	return sigmoid(standardized);
}

/**
 * Uncalibrated: weighted mean of the profile terms (interest, geo, pref, bio), plus mood and daily answer as
 * offsets from their neutral. A missing bio drops that term and renormalizes the rest.
 */
function uncalibratedUnilateral(u: ScoringProfile, v: ScoringProfile, w: ScoringWeights): number {
	const components: [number, number | null][] = [
		[w.interest, interestSimilarity(u.interests, v.interests, u.customInterests, v.customInterests)],
		[w.geo, geoProximity(u, v)],
		[w.pref, directedPreferenceMatch(u, v)],
		[w.bio, bioSimilarity(u.bioEmbedding, v.bioEmbedding)],
	];
	let weighted = 0;
	let profileWeight = 0;

	for (const [weight, value] of components) {
		if (value !== null) {
			weighted += weight * value;
			profileWeight += weight;
		}
	}

	if (profileWeight === 0) {
		return 0;
	}

	// Mood only lifts: a low mood is a disclosure, not something to lose exposure over.
	const moodOffset = Math.max(0, (moodCompatibility(u.mood, v.mood) ?? CONTEXT_NEUTRAL) - CONTEXT_NEUTRAL);
	const answerOffset = (dailyAnswerSimilarity(u.dailyAnswer, v.dailyAnswer) ?? CONTEXT_NEUTRAL) - CONTEXT_NEUTRAL;
	const contextLift = (w.mood * moodOffset + w.dailyAnswer * answerOffset) / (profileWeight + w.mood + w.dailyAnswer);

	return clampUnitInterval(weighted / profileWeight + contextLift);
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
	calibration: ComponentCalibration | null = COMPONENT_CALIBRATION,
): ReciprocalScoreResult {
	const pUToV = unilateral(u, v, w, calibration);
	const qVToU = unilateral(v, u, w, calibration);
	const sum = pUToV + qVToU;
	const reciprocal = sum === 0 ? 0 : (2 * pUToV * qVToU) / sum;

	return { reciprocal, pUToV, qVToU };
}

export type ScoreBreakdown = {
	interest: number;
	geo: number;
	/** How well v fits what u is looking for. */
	prefUToV: number;
	/** How well u fits what v is looking for. */
	prefVToU: number;
	bio: number | null;
	/** Null when either side has not checked in today. */
	mood: number | null;
	/** Null when either side has not answered today's question. */
	dailyAnswer: number | null;
	reciprocal: number;
};

/** Per-component view of `reciprocalScore`, used to explain a match. */
export function scoreBreakdown(
	u: ScoringProfile,
	v: ScoringProfile,
	w: ScoringWeights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
	return {
		interest: interestSimilarity(u.interests, v.interests, u.customInterests, v.customInterests),
		geo: geoProximity(u, v),
		prefUToV: directedPreferenceMatch(u, v),
		prefVToU: directedPreferenceMatch(v, u),
		bio: bioSimilarity(u.bioEmbedding, v.bioEmbedding),
		mood: moodCompatibility(u.mood, v.mood),
		dailyAnswer: dailyAnswerSimilarity(u.dailyAnswer, v.dailyAnswer),
		reciprocal: reciprocalScore(u, v, w).reciprocal,
	};
}

const LOGIT_EPS = 1e-6;

/** Maps a (0, 1) score back to standardized units, so a re-rank shift means the same σ anywhere on the curve. */
export function logit(p: number): number {
	const clamped = Math.min(1 - LOGIT_EPS, Math.max(LOGIT_EPS, p));

	return Math.log(clamped / (1 - clamped));
}

export function sigmoid(x: number): number {
	return 1 / (1 + Math.exp(-x));
}

/** Saturating crossing-count norm in [0, 1): norm(3) ≈ 0.63 with the default K. */
export function crossPathsNorm(count: number, K: number = CROSS_PATHS.K): number {
	return count > 0 ? 1 - Math.exp(-count / K) : 0;
}

/**
 * Symmetric serendipity nudge applied once to the reciprocal score (not inside `unilateral`):
 * `sigmoid(logit(reciprocal) + lambda · norm(count))`, a shift of at most `lambda` σ wherever the score sits.
 */
export function applyCrossPathsBoost(reciprocal: number, count: number, lambda: number = CROSS_PATHS.lambda): number {
	const boost = lambda * crossPathsNorm(count);

	return boost > 0 ? sigmoid(logit(reciprocal) + boost) : reciprocal;
}

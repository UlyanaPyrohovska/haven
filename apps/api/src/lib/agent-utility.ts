import {
	bioSimilarity,
	dailyAnswerSimilarity,
	geoProximity,
	moodCompatibility,
	type ScoringProfile,
	type ScoringWeights,
} from "@/lib/scoring";

/**
 * Frozen ground truth for simulation agents: the scoring formula as of commit a7ad2c3 (plain cosine
 * interest/pref, renormalized weighted mean incl. mood and answer). Agents decide on this, not on the
 * live `unilateral`, so changing the recommender doesn't also change what agents want.
 * Never tune this alongside the recommender; simulation runs are only comparable while it stays fixed.
 */

/** Component weights agents start from (the a7ad2c3 defaults), independent of the live `DEFAULT_WEIGHTS`. */
export const AGENT_BASE_WEIGHTS: ScoringWeights = {
	bio: 0.3,
	interest: 0.25,
	geo: 0.15,
	pref: 0.15,
	mood: 0.05,
	dailyAnswer: 0.1,
};

const INTEREST_DIM = 17;
const TRAIT_DIM = 6;
const INTEREST_NEUTRAL = 5;
const CUSTOM_INTEREST_ON = 10;
const CUSTOM_INTEREST_OFF = 1;
const SELF_NEUTRAL = 5;
const PREF_NEUTRAL = 100 / TRAIT_DIM;

function fill(values: readonly (number | null | undefined)[], length: number, neutral: number): number[] {
	return Array.from({ length }, (_, i) => values[i] ?? neutral);
}

/** Cosine clamped to [0, 1]; 0 when either vector has zero norm. */
function cosine(a: readonly number[], b: readonly number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	return normA === 0 || normB === 0 ? 0 : Math.min(1, Math.max(0, dot / Math.sqrt(normA * normB)));
}

function interestCosine(u: ScoringProfile, v: ScoringProfile): number {
	const a = fill(u.interests, INTEREST_DIM, INTEREST_NEUTRAL);
	const b = fill(v.interests, INTEREST_DIM, INTEREST_NEUTRAL);
	const setA = new Set(u.customInterests ?? []);
	const setB = new Set(v.customInterests ?? []);

	for (const label of new Set([...setA, ...setB])) {
		a.push(setA.has(label) ? CUSTOM_INTEREST_ON : CUSTOM_INTEREST_OFF);
		b.push(setB.has(label) ? CUSTOM_INTEREST_ON : CUSTOM_INTEREST_OFF);
	}

	return cosine(a, b);
}

/** Directional utility of `v` for agent `u` under the frozen formula, in [0, 1]. */
export function agentUtility(u: ScoringProfile, v: ScoringProfile, w: ScoringWeights = AGENT_BASE_WEIGHTS): number {
	const components: [number, number | null][] = [
		[w.interest, interestCosine(u, v)],
		[w.geo, geoProximity(u, v)],
		[w.pref, cosine(fill(u.pref, TRAIT_DIM, PREF_NEUTRAL), fill(v.self, TRAIT_DIM, SELF_NEUTRAL))],
		[w.bio, bioSimilarity(u.bioEmbedding, v.bioEmbedding)],
		[w.mood, moodCompatibility(u.mood, v.mood)],
		[w.dailyAnswer, dailyAnswerSimilarity(u.dailyAnswer, v.dailyAnswer)],
	];
	let weighted = 0;
	let totalWeight = 0;

	for (const [weight, value] of components) {
		if (value !== null) {
			weighted += weight * value;
			totalWeight += weight;
		}
	}

	return totalWeight === 0 ? 0 : Math.min(1, Math.max(0, weighted / totalWeight));
}

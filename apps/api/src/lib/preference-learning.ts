/**
 * Learned partner preferences: blends a user's stated `pref` split with a Rocchio-style vector built from the
 * self-ratings of profiles they liked and passed on. `lambda = 0` reproduces the stated-only ranking (thesis ablation).
 */
export const PREFERENCE_LEARNING = {
	/** Max share of the learned vector once a user has made many decisions. */
	lambda: 0.5,
	/** Decisions at which the learned share reaches half of `lambda`. */
	n0: 10,
	/** How strongly passed profiles push the learned vector away (Rocchio γ). */
	passWeight: 0.5,
} as const;

/** One decision: the other profile's self-ratings and whether it was liked. */
export type PreferenceDecision = { self: readonly (number | null)[]; liked: boolean };

const TRAIT_DIM = 6;
const SELF_NEUTRAL = 5;
const PREF_NEUTRAL = 100 / TRAIT_DIM;
const PREF_TOTAL = 100;
/** Keeps every dimension positive so the cosine stays defined and no trait is fully ignored. */
const MIN_SHARE = 0.01;

function meanSelf(decisions: readonly PreferenceDecision[]): number[] {
	const sum = new Array<number>(TRAIT_DIM).fill(0);

	for (const { self } of decisions) {
		for (let i = 0; i < TRAIT_DIM; i++) {
			sum[i] += self[i] ?? SELF_NEUTRAL;
		}
	}

	return sum.map((value) => value / decisions.length);
}

/** `mean(liked) − passWeight · mean(passed)`, rescaled to the 100-point `pref` split; null without any like. */
export function learnedPreference(
	decisions: readonly PreferenceDecision[],
	passWeight: number = PREFERENCE_LEARNING.passWeight,
): number[] | null {
	const liked = decisions.filter((decision) => decision.liked);

	if (liked.length === 0) {
		return null;
	}

	const passed = decisions.filter((decision) => !decision.liked);
	const likedMean = meanSelf(liked);
	const passedMean = passed.length > 0 ? meanSelf(passed) : null;
	const raw = likedMean.map((value, i) => Math.max(MIN_SHARE, value - (passedMean ? passWeight * passedMean[i] : 0)));
	const total = raw.reduce((sum, value) => sum + value, 0);

	return raw.map((value) => (value / total) * PREF_TOTAL);
}

/** `(1 − s) · stated + s · learned` with `s = lambda · n / (n + n0)`; returns `stated` untouched when off. */
export function blendPreference(
	stated: (number | null)[],
	decisions: readonly PreferenceDecision[],
	lambda: number = PREFERENCE_LEARNING.lambda,
	n0: number = PREFERENCE_LEARNING.n0,
	passWeight: number = PREFERENCE_LEARNING.passWeight,
): (number | null)[] {
	const learned = lambda > 0 ? learnedPreference(decisions, passWeight) : null;

	if (!learned) {
		return stated;
	}

	const share = (lambda * decisions.length) / (decisions.length + n0);

	return learned.map((value, i) => (1 - share) * (stated[i] ?? PREF_NEUTRAL) + share * value);
}

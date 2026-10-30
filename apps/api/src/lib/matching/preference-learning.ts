/**
 * Learned partner preferences: a trait direction learned from who a user liked among everyone they decided on,
 * blended with the stated `pref` split in score space (`directedPreferenceMatch` in `scoring.ts`).
 * `lambda = 0` reproduces the stated-only ranking (thesis ablation).
 */
export const PREFERENCE_LEARNING = {
	/** Max share of the learned vector once a user has made many decisions. */
	lambda: 0.5,
	/** Decisions at which the learned share reaches half of `lambda`. */
	n0: 10,
	/** Contrast norm (in z units) at which the learned share reaches half; weaker tastes count less. */
	contrastHalf: 0.5,
} as const;

/** One decision: the other profile's self-ratings and whether it was liked. */
export type PreferenceDecision = { self: readonly (number | null)[]; liked: boolean };

const TRAIT_DIM = 6;
const SELF_NEUTRAL = 5;
/** Below this spread the liked-vs-decided contrast is noise, not a taste. */
const MIN_CONTRAST_SD = 1e-6;

/** z-scores a 6-trait vector (nulls as `neutral`); a flat vector gives zeros. */
function centered(values: readonly (number | null)[], neutral: number): number[] {
	const filled = Array.from({ length: TRAIT_DIM }, (_, i) => values[i] ?? neutral);
	const mean = filled.reduce((sum, value) => sum + value, 0) / TRAIT_DIM;
	const sd = Math.sqrt(filled.reduce((sum, value) => sum + (value - mean) ** 2, 0) / TRAIT_DIM);

	return filled.map((value) => (sd < MIN_CONTRAST_SD ? 0 : (value - mean) / sd));
}

function meanCentered(decisions: readonly PreferenceDecision[]): number[] {
	const sum = new Array<number>(TRAIT_DIM).fill(0);

	for (const { self } of decisions) {
		centered(self, SELF_NEUTRAL).forEach((value, i) => {
			sum[i] += value;
		});
	}

	return sum.map((value) => value / decisions.length);
}

/** `mean(z liked) − mean(z decided)`; null without a like. */
function likedContrast(decisions: readonly PreferenceDecision[]): number[] | null {
	const liked = decisions.filter((decision) => decision.liked);

	if (liked.length === 0) {
		return null;
	}

	const decidedMean = meanCentered(decisions);

	return meanCentered(liked).map((value, i) => value - decidedMean[i]);
}

/**
 * Direction of the liked-vs-decided contrast, z-scored. Self-ratings are centered per profile, so "everyone
 * rates themselves high on sincerity" cancels; the decided set is what the recommender showed, so
 * subtracting it also cancels the recommender's own selection. Null without a like or without any contrast.
 */
export function learnedPreference(decisions: readonly PreferenceDecision[]): number[] | null {
	const contrast = likedContrast(decisions);
	const direction = contrast ? centered(contrast, 0) : null;

	return direction?.some((value) => value !== 0) ? direction : null;
}

export type LearnedPreference = { direction: number[]; share: number };

/**
 * The learned direction and its share of the preference term:
 * `s = lambda · n / (n + n0) · ‖c‖ / (‖c‖ + contrastHalf)`, so few decisions or a weak contrast (likes that
 * look like everything decided on) barely move the score. Null when off (`lambda = 0`) or nothing is learned.
 */
export function learnPreference(
	decisions: readonly PreferenceDecision[],
	lambda: number = PREFERENCE_LEARNING.lambda,
	n0: number = PREFERENCE_LEARNING.n0,
	contrastHalf: number = PREFERENCE_LEARNING.contrastHalf,
): LearnedPreference | null {
	const direction = lambda > 0 ? learnedPreference(decisions) : null;
	const contrast = direction ? likedContrast(decisions) : null;

	if (!direction || !contrast) {
		return null;
	}

	const strength = Math.sqrt(contrast.reduce((sum, value) => sum + value * value, 0));
	const share = ((lambda * decisions.length) / (decisions.length + n0)) * (strength / (strength + contrastHalf));

	return { direction, share };
}

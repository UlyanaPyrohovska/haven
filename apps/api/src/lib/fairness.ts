/** Exposure fairness defaults; `mu = 0` and `cap = null` reproduce the unfair baseline (thesis ablation). */
export const FAIRNESS = {
	mu: 0.3,
	cap: null as number | null,
	windowDays: 7,
	/** Half-saturation of the penalty when no cap is set: 5 impressions → half of `mu`. */
	e0: 5,
};

export type FairnessOptions = { mu: number; cap: number | null };

type Ranked = { candidateId: number; score: number };

/** Saturating penalty: `score * (1 - mu * e / (e + e0))`, so it lies in `[score * (1 - mu), score]`. */
export function exposurePenalty(score: number, exposures: number, mu: number, e0: number = FAIRNESS.e0): number {
	return exposures > 0 ? score * (1 - (mu * exposures) / (exposures + e0)) : score;
}

/**
 * Reranks an already-sorted list (exempt ids first, then score) for candidate exposure and takes `k`.
 * Candidates at or over `cap` impressions only fill slots the uncapped ones leave empty.
 * Exempt ids (pending likers) skip the penalty and cap. Returned scores stay the unpenalized relevance.
 */
export function rerankForExposure<T extends Ranked>(
	ranked: T[],
	exposures: ReadonlyMap<number, number>,
	k: number,
	{ mu, cap }: FairnessOptions,
	exemptIds: ReadonlySet<number> = new Set(),
): T[] {
	const e0 = cap ?? FAIRNESS.e0;

	return ranked
		.map((row) => {
			const exempt = exemptIds.has(row.candidateId);
			const e = exempt ? 0 : (exposures.get(row.candidateId) ?? 0);

			return { row, exempt, capped: cap !== null && e >= cap, fair: exposurePenalty(row.score, e, mu, e0) };
		})
		.sort((a, b) => Number(b.exempt) - Number(a.exempt) || Number(a.capped) - Number(b.capped) || b.fair - a.fair)
		.slice(0, k)
		.map(({ row }) => row);
}

/** Gini coefficient of exposure counts (0 = everyone shown equally, → 1 = one profile gets everything). */
export function gini(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const n = sorted.length;
	const total = sorted.reduce((sum, value) => sum + value, 0);

	if (n === 0 || total === 0) {
		return 0;
	}

	const weighted = sorted.reduce((sum, value, i) => sum + (i + 1) * value, 0);

	return (2 * weighted) / (n * total) - (n + 1) / n;
}

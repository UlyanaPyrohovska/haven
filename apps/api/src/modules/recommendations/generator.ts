import type { Db } from "@/db";
import { CADENCE, DEFAULT_WEIGHTS, reciprocalScore, type ScoringWeights } from "@/lib/scoring";
import * as repository from "./repository";

/** Max candidates scored per generation pass (full scan at ~2k users). */
export const POOL_LIMIT = 500;

/**
 * When the viewer has a bio embedding, pre-rank with pgvector HNSW (`bio <=> viewer`) before
 * exact reciprocal rescoring. Keeps latency predictable as the corpus grows.
 */
export const ANN_SHORTLIST_LIMIT = 200;

export type GenerateRecommendationsOptions = {
	k?: number;
	maxKm?: number | null;
	weights?: ScoringWeights;
};

/** One exposure-limited batch (default {@link CADENCE.batchSize}) for the daily drop. */
export async function generateRecommendations(
	db: Db,
	viewerId: number,
	opts: GenerateRecommendationsOptions = {},
): Promise<number> {
	const k = opts.k ?? CADENCE.batchSize;
	const maxKm = opts.maxKm ?? null;
	const weights = opts.weights ?? DEFAULT_WEIGHTS;

	const viewer = await repository.findScoringProfileById(db, viewerId);

	if (!viewer) {
		return 0;
	}

	const pool = await repository.listCandidatePool(db, viewer, {
		maxKm,
		limit: POOL_LIMIT,
		annShortlistLimit: ANN_SHORTLIST_LIMIT,
	});

	const ranked = pool
		.map((candidate) => {
			const { reciprocal } = reciprocalScore(viewer, candidate, weights);

			return { candidateId: candidate.id, score: reciprocal };
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, k);

	await repository.replaceRecommendations(
		db,
		viewerId,
		ranked.map((row, index) => ({
			candidateId: row.candidateId,
			score: row.score,
			rank: index + 1,
		})),
	);

	return ranked.length;
}

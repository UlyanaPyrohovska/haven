import type { Db } from "@/db";
import {
	applyCrossPathsBoost,
	CADENCE,
	CROSS_PATHS,
	DEFAULT_WEIGHTS,
	reciprocalScore,
	type ScoringProfile,
	type ScoringWeights,
} from "@/lib/scoring";
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
	/** Cross-paths boost strength; 0 reproduces the pure reciprocal ranking (thesis ablation). */
	crossPathsLambda?: number;
};

export type RankedCandidate = { candidateId: number; score: number };

/** Reciprocal score with the cross-paths boost, best first. Missing counts (no row / opted out) mean 0. */
export function rankCandidates(
	viewer: ScoringProfile,
	pool: ScoringProfile[],
	crossings: ReadonlyMap<number, { count: number }>,
	k: number,
	weights: ScoringWeights = DEFAULT_WEIGHTS,
	crossPathsLambda: number = CROSS_PATHS.lambda,
): RankedCandidate[] {
	return pool
		.map((candidate) => {
			const { reciprocal } = reciprocalScore(viewer, candidate, weights);
			const count = crossings.get(candidate.id)?.count ?? 0;

			return { candidateId: candidate.id, score: applyCrossPathsBoost(reciprocal, count, crossPathsLambda) };
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, k);
}

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

	const crossings = await repository.listCrossings(
		db,
		viewerId,
		pool.map((candidate) => candidate.id),
	);
	const ranked = rankCandidates(viewer, pool, crossings, k, weights, opts.crossPathsLambda);

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

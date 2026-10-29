import type { Db } from "@/db";
import { rerankForExposure } from "@/lib/fairness";
import {
	applyCrossPathsBoost,
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
	/** Exposure penalty strength; 0 with no cap reproduces the unfair ranking (thesis ablation). */
	fairnessMu?: number;
	/** Impressions per window after which a candidate only fills leftover slots; null = no cap. */
	exposureCap?: number | null;
	/** Restrict the pool to synthetic profiles (simulation agents). */
	syntheticOnly?: boolean;
	/** Reuse this `shown_at` instead of now (user regenerate keeps the cooldown). */
	shownAt?: Date;
};

export type RankedCandidate = { candidateId: number; score: number };

/**
 * Reciprocal score with the cross-paths boost, best first. Missing counts (no row / opted out) mean 0.
 * Candidates in `likerIds` (pending likes on the viewer) go first so a one-sided like can become a match.
 * Pass `k = Infinity` to keep the whole ranked pool (the exposure reranker takes the batch).
 */
export function rankCandidates(
	viewer: ScoringProfile,
	pool: ScoringProfile[],
	crossings: ReadonlyMap<number, { count: number }>,
	k: number,
	weights: ScoringWeights = DEFAULT_WEIGHTS,
	crossPathsLambda: number = CROSS_PATHS.lambda,
	likerIds: ReadonlySet<number> = new Set(),
): RankedCandidate[] {
	return pool
		.map((candidate) => {
			const { reciprocal } = reciprocalScore(viewer, candidate, weights);
			const count = crossings.get(candidate.id)?.count ?? 0;

			return { candidateId: candidate.id, score: applyCrossPathsBoost(reciprocal, count, crossPathsLambda) };
		})
		.sort((a, b) => Number(likerIds.has(b.candidateId)) - Number(likerIds.has(a.candidateId)) || b.score - a.score)
		.slice(0, k);
}

/** One exposure-limited batch for the daily drop; unset options come from the saved matching config. */
export async function generateRecommendations(
	db: Db,
	viewerId: number,
	opts: GenerateRecommendationsOptions = {},
): Promise<number> {
	const config = await repository.loadMatchingConfig(db);
	const k = opts.k ?? config.batchSize;
	const maxKm = opts.maxKm ?? null;
	const weights = opts.weights ?? config.weights;
	const crossPathsLambda = opts.crossPathsLambda ?? config.crossPathsLambda;
	const fairness = {
		mu: opts.fairnessMu ?? config.fairnessMu,
		cap: opts.exposureCap !== undefined ? opts.exposureCap : config.exposureCap,
	};
	const exposureSince = new Date(Date.now() - config.exposureWindowDays * 24 * 60 * 60 * 1000);

	const viewer = await repository.findScoringProfileById(db, viewerId);

	if (!viewer) {
		return 0;
	}

	const pool = await repository.listCandidatePool(db, viewer, {
		maxKm,
		limit: POOL_LIMIT,
		annShortlistLimit: ANN_SHORTLIST_LIMIT,
		syntheticOnly: opts.syntheticOnly,
	});

	const poolIds = pool.map((candidate) => candidate.id);
	const [crossings, likerIds, exposures] = await Promise.all([
		repository.listCrossings(db, viewerId, poolIds),
		repository.listPendingLikerIds(db, viewerId),
		repository.listExposureCounts(db, poolIds, exposureSince),
	]);
	const ranked = rerankForExposure(
		rankCandidates(viewer, pool, crossings, Number.POSITIVE_INFINITY, weights, crossPathsLambda, likerIds),
		exposures,
		k,
		fairness,
		likerIds,
	);

	await repository.replaceRecommendations(
		db,
		viewerId,
		ranked.map((row, index) => ({
			candidateId: row.candidateId,
			score: row.score,
			rank: index + 1,
		})),
		opts.shownAt,
	);

	return ranked.length;
}

import type { Db } from "@/db";
import { rerankForExposure } from "@/lib/matching/fairness";
import { learnPreference } from "@/lib/matching/preference-learning";
import {
	applyCrossPathsBoost,
	CROSS_PATHS,
	DEFAULT_WEIGHTS,
	reciprocalScore,
	type ScoringProfile,
	type ScoringWeights,
} from "@/lib/matching/scoring";
import { seededRandom } from "@/lib/simulation/agent-decision";
import * as repository from "./repository";

/** Max candidates scored per generation pass (full scan at ~2k users). */
export const POOL_LIMIT = 500;

/**
 * When the viewer has a bio embedding, this many pool slots go to the closest bios; the rest of
 * `POOL_LIMIT` is filled at random so profiles without an embedding still get scored.
 */
export const ANN_SHORTLIST_LIMIT = 200;

/** Pending likers that jump the queue per batch; the rest compete on score so a batch isn't all likers. */
export const LIKER_SLOTS = 2;

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
	/** Share of preferences learned from likes/passes; 0 reproduces the stated-only ranking (thesis ablation). */
	preferenceLambda?: number;
	/** Restrict the pool to synthetic profiles (simulation agents). */
	syntheticOnly?: boolean;
	/** Reuse this `shown_at` instead of now (user regenerate keeps the cooldown). */
	shownAt?: Date;
};

/** Attaches each profile's learned taste from its own likes and passes (both sides learn). */
export async function withLearnedPreferences<T extends ScoringProfile>(
	db: Db,
	profiles: T[],
	preferenceLambda: number,
): Promise<T[]> {
	if (preferenceLambda <= 0) {
		return profiles;
	}

	const decisions = await repository.listPreferenceDecisions(
		db,
		profiles.map((profile) => profile.id),
	);

	return profiles.map((profile) => {
		const learned = learnPreference(decisions.get(profile.id) ?? [], preferenceLambda);

		return learned ? { ...profile, learnedPref: learned.direction, learnedShare: learned.share } : profile;
	});
}

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

/** The best-scoring pending likers, up to `slots`; these skip the exposure reranker and lead the batch. */
export function reserveLikerSlots(
	ranked: readonly RankedCandidate[],
	likerIds: ReadonlySet<number>,
	slots: number = LIKER_SLOTS,
): Set<number> {
	return new Set(
		ranked
			.filter((row) => likerIds.has(row.candidateId))
			.sort((a, b) => b.score - a.score)
			.slice(0, slots)
			.map((row) => row.candidateId),
	);
}

/** Fisher–Yates driven by `seed`, so a batch keeps its order across reloads. */
export function shuffleSeeded<T>(items: readonly T[], seed: string): T[] {
	const out = [...items];

	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(seededRandom(`${seed}:${i}`) * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}

	return out;
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
	const preferenceLambda = opts.preferenceLambda ?? config.preferenceLambda;
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
	const [crossings, likerIds, exposures, [learnedViewer, ...learnedPool]] = await Promise.all([
		repository.listCrossings(db, viewerId, poolIds),
		repository.listPendingLikerIds(db, viewerId),
		repository.listExposureCounts(db, poolIds, exposureSince),
		withLearnedPreferences(db, [viewer, ...pool], preferenceLambda),
	]);
	const scored = rankCandidates(
		learnedViewer,
		learnedPool,
		crossings,
		Number.POSITIVE_INFINITY,
		weights,
		crossPathsLambda,
		likerIds,
	);
	const ranked = rerankForExposure(scored, exposures, k, fairness, reserveLikerSlots(scored, likerIds));
	const shownAt = opts.shownAt ?? new Date();
	// Display order is shuffled so reserved likers don't always sit on top and give away who liked you.
	const displayed = shuffleSeeded(ranked, `${viewerId}:${shownAt.toISOString()}`);

	await repository.replaceRecommendations(
		db,
		viewerId,
		displayed.map((row, index) => ({
			candidateId: row.candidateId,
			score: row.score,
			rank: index + 1,
		})),
		opts.shownAt,
	);

	return ranked.length;
}

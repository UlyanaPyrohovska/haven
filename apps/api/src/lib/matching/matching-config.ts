import { FAIRNESS } from "@/lib/matching/fairness";
import { PREFERENCE_LEARNING } from "@/lib/matching/preference-learning";
import { resolveRecCooldownHours } from "@/lib/matching/recommendation-cadence";
import { CADENCE, CROSS_PATHS, DEFAULT_WEIGHTS, type ScoringWeights } from "@/lib/matching/scoring";

export type MatchingConfig = {
	batchSize: number;
	cooldownHours: number;
	weights: ScoringWeights;
	crossPathsLambda: number;
	fairnessMu: number;
	exposureCap: number | null;
	exposureWindowDays: number;
	preferenceLambda: number;
};

export type MatchingConfigRow = {
	batchSize: number;
	cooldownHours: number;
	weightBio: number;
	weightInterest: number;
	weightGeo: number;
	weightPref: number;
	weightMood: number;
	weightDailyAnswer: number;
	crossPathsLambda: number;
	fairnessMu: number;
	exposureCap: number | null;
	exposureWindowDays: number;
	preferenceLambda: number;
};

/** Saved row wins; otherwise code defaults, with the cooldown still overridable by `REC_COOLDOWN_HOURS`. */
export function resolveMatchingConfig(row: MatchingConfigRow | null | undefined, envCooldown?: string): MatchingConfig {
	if (!row) {
		return {
			batchSize: CADENCE.batchSize,
			cooldownHours: resolveRecCooldownHours(envCooldown),
			weights: DEFAULT_WEIGHTS,
			crossPathsLambda: CROSS_PATHS.lambda,
			fairnessMu: FAIRNESS.mu,
			exposureCap: FAIRNESS.cap,
			exposureWindowDays: FAIRNESS.windowDays,
			preferenceLambda: PREFERENCE_LEARNING.lambda,
		};
	}

	return {
		batchSize: row.batchSize,
		cooldownHours: row.cooldownHours,
		weights: {
			bio: row.weightBio,
			interest: row.weightInterest,
			geo: row.weightGeo,
			pref: row.weightPref,
			mood: row.weightMood,
			dailyAnswer: row.weightDailyAnswer,
		},
		crossPathsLambda: row.crossPathsLambda,
		fairnessMu: row.fairnessMu,
		exposureCap: row.exposureCap,
		exposureWindowDays: row.exposureWindowDays,
		preferenceLambda: row.preferenceLambda,
	};
}

export function toMatchingConfigRow(config: MatchingConfig): MatchingConfigRow {
	return {
		batchSize: config.batchSize,
		cooldownHours: config.cooldownHours,
		weightBio: config.weights.bio,
		weightInterest: config.weights.interest,
		weightGeo: config.weights.geo,
		weightPref: config.weights.pref,
		weightMood: config.weights.mood,
		weightDailyAnswer: config.weights.dailyAnswer,
		crossPathsLambda: config.crossPathsLambda,
		fairnessMu: config.fairnessMu,
		exposureCap: config.exposureCap,
		exposureWindowDays: config.exposureWindowDays,
		preferenceLambda: config.preferenceLambda,
	};
}

/** Keeps staff weights readable as shares of the score; allow float noise from the form. */
export function weightsSumToOne(weights: ScoringWeights): boolean {
	return Math.abs(Object.values(weights).reduce((sum, weight) => sum + weight, 0) - 1) < 0.001;
}

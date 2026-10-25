import { resolveRecCooldownHours } from "@/lib/recommendation-cadence";
import { CADENCE, CROSS_PATHS, DEFAULT_WEIGHTS, type ScoringWeights } from "@/lib/scoring";

export type MatchingConfig = {
	batchSize: number;
	cooldownHours: number;
	weights: ScoringWeights;
	crossPathsLambda: number;
};

export type MatchingConfigRow = {
	batchSize: number;
	cooldownHours: number;
	weightBio: number;
	weightInterest: number;
	weightGeo: number;
	weightPref: number;
	crossPathsLambda: number;
};

/** Saved row wins; otherwise code defaults, with the cooldown still overridable by `REC_COOLDOWN_HOURS`. */
export function resolveMatchingConfig(row: MatchingConfigRow | null | undefined, envCooldown?: string): MatchingConfig {
	if (!row) {
		return {
			batchSize: CADENCE.batchSize,
			cooldownHours: resolveRecCooldownHours(envCooldown),
			weights: DEFAULT_WEIGHTS,
			crossPathsLambda: CROSS_PATHS.lambda,
		};
	}

	return {
		batchSize: row.batchSize,
		cooldownHours: row.cooldownHours,
		weights: { bio: row.weightBio, interest: row.weightInterest, geo: row.weightGeo, pref: row.weightPref },
		crossPathsLambda: row.crossPathsLambda,
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
		crossPathsLambda: config.crossPathsLambda,
	};
}

/** `unilateral` assumes the weights sum to 1; allow float noise from the form. */
export function weightsSumToOne(weights: ScoringWeights): boolean {
	return Math.abs(weights.bio + weights.interest + weights.geo + weights.pref - 1) < 0.001;
}

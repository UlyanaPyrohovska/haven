import type { ScoreBreakdown } from "@/lib/scoring";

export const MatchReasons = [
	"sharedInterests",
	"theirType",
	"yourType",
	"nearby",
	"crossedPaths",
	"compatible",
] as const;
export type MatchReason = (typeof MatchReasons)[number];

/** Thresholds on [0, 1] component scores above which a component counts as a reason. */
export const MATCH_REASON_THRESHOLDS = {
	interest: 0.75,
	pref: 0.8,
	geo: 0.6,
} as const;

export type MatchReasonContext = {
	sharedInterestCount: number;
	/** Candidate's privacy flag; without it proximity is never mentioned. */
	shareLocation: boolean;
	/** Already privacy-gated by `shouldShowCrossPaths`; null when hidden. */
	crossPathsCount: number | null;
};

/** Human-readable reasons for a match, strongest signals first. Never empty. */
export function matchReasons(breakdown: ScoreBreakdown, context: MatchReasonContext): MatchReason[] {
	const reasons: MatchReason[] = [];

	if (context.sharedInterestCount > 0 || breakdown.interest >= MATCH_REASON_THRESHOLDS.interest) {
		reasons.push("sharedInterests");
	}

	if (breakdown.prefUToV >= MATCH_REASON_THRESHOLDS.pref) {
		reasons.push("theirType");
	}

	if (breakdown.prefVToU >= MATCH_REASON_THRESHOLDS.pref) {
		reasons.push("yourType");
	}

	if (context.shareLocation && breakdown.geo >= MATCH_REASON_THRESHOLDS.geo) {
		reasons.push("nearby");
	}

	if ((context.crossPathsCount ?? 0) > 0) {
		reasons.push("crossedPaths");
	}

	return reasons.length > 0 ? reasons : ["compatible"];
}

import { describe, expect, it } from "vitest";
import { matchReasons } from "@/lib/match-reasons";
import type { ScoreBreakdown } from "@/lib/scoring";

const weak: ScoreBreakdown = {
	interest: 0.3,
	geo: 0.1,
	prefUToV: 0.4,
	prefVToU: 0.4,
	bio: null,
	mood: null,
	dailyAnswer: null,
	reciprocal: 0.4,
};
const strong: ScoreBreakdown = {
	interest: 0.9,
	geo: 0.9,
	prefUToV: 0.95,
	prefVToU: 0.85,
	bio: null,
	mood: null,
	dailyAnswer: null,
	reciprocal: 0.9,
};

describe("matchReasons", () => {
	it("falls back to compatible when no component stands out", () => {
		expect(matchReasons(weak, { sharedInterestCount: 0, shareLocation: true, crossPathsCount: null })).toEqual([
			"compatible",
		]);
	});

	it("lists strong components in order", () => {
		expect(matchReasons(strong, { sharedInterestCount: 2, shareLocation: true, crossPathsCount: 3 })).toEqual([
			"sharedInterests",
			"theirType",
			"yourType",
			"nearby",
			"crossedPaths",
		]);
	});

	it("never mentions proximity when the candidate hides location", () => {
		expect(matchReasons(strong, { sharedInterestCount: 0, shareLocation: false, crossPathsCount: 0 })).not.toContain(
			"nearby",
		);
	});
});

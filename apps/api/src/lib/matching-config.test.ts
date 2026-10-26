import { describe, expect, it } from "vitest";
import { resolveMatchingConfig, toMatchingConfigRow, weightsSumToOne } from "@/lib/matching-config";
import { CADENCE, DEFAULT_WEIGHTS } from "@/lib/scoring";

describe("resolveMatchingConfig", () => {
	it("falls back to code defaults and the env cooldown when nothing is saved", () => {
		const config = resolveMatchingConfig(null, "6");

		expect(config.batchSize).toBe(CADENCE.batchSize);
		expect(config.cooldownHours).toBe(6);
		expect(config.weights).toEqual(DEFAULT_WEIGHTS);
	});

	it("uses the saved row over the env cooldown and round-trips", () => {
		const row = {
			batchSize: 8,
			cooldownHours: 12,
			weightBio: 0.4,
			weightInterest: 0.3,
			weightGeo: 0.2,
			weightPref: 0.05,
			weightMood: 0.02,
			weightDailyAnswer: 0.03,
			crossPathsLambda: 0,
		};
		const config = resolveMatchingConfig(row, "6");

		expect(config.cooldownHours).toBe(12);
		expect(toMatchingConfigRow(config)).toEqual(row);
	});
});

describe("weightsSumToOne", () => {
	it("accepts float noise and rejects a real mismatch", () => {
		expect(weightsSumToOne({ bio: 0.1 + 0.2, interest: 0.3, geo: 0.2, pref: 0.1, mood: 0.05, dailyAnswer: 0.05 })).toBe(
			true,
		);
		expect(weightsSumToOne({ bio: 0.5, interest: 0.3, geo: 0.2, pref: 0.2, mood: 0, dailyAnswer: 0 })).toBe(false);
	});
});

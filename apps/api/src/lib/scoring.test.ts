import { describe, expect, it } from "vitest";
import {
	applyCrossPathsBoost,
	bioSimilarity,
	crossPathsNorm,
	DEFAULT_WEIGHTS,
	geoProximity,
	interestSimilarity,
	preferenceMatch,
	reciprocalScore,
	type ScoringProfile,
	scoreBreakdown,
	unilateral,
} from "@/lib/scoring";

const uniformInterests = () => Array.from({ length: 17 }, () => 5);
const uniformPref = () => Array.from({ length: 6 }, () => 100 / 6);
const uniformSelf = () => Array.from({ length: 6 }, () => 5);

function makeProfile(overrides: Partial<ScoringProfile> & Pick<ScoringProfile, "id">): ScoringProfile {
	return {
		interests: uniformInterests(),
		pref: uniformPref(),
		self: uniformSelf(),
		latitude: 38.7223,
		longitude: -9.1393,
		bioEmbedding: null,
		...overrides,
	};
}

describe("interestSimilarity", () => {
	it("returns ~1 for identical vectors", () => {
		const interests = Array.from({ length: 17 }, (_, i) => (i % 3) + 3);

		expect(interestSimilarity(interests, interests)).toBeCloseTo(1, 5);
	});

	it("returns low score for opposing interest patterns", () => {
		const a = Array.from({ length: 17 }, (_, i) => (i < 9 ? 10 : 1));
		const b = Array.from({ length: 17 }, (_, i) => (i < 9 ? 1 : 10));

		expect(interestSimilarity(a, b)).toBeLessThan(0.35);
	});

	it("treats null interests as neutral midpoint", () => {
		const filled = uniformInterests();
		const withNulls = Array.from({ length: 17 }, () => null);

		expect(interestSimilarity(filled, withNulls)).toBeCloseTo(1, 5);
	});

	it("raises the score for shared custom interests and lowers it for unshared ones", () => {
		const a = Array.from({ length: 17 }, (_, i) => (i < 9 ? 10 : 1));
		const b = Array.from({ length: 17 }, (_, i) => (i < 5 ? 10 : 1));
		const base = interestSimilarity(a, b);

		expect(interestSimilarity(a, b, [], [])).toBe(base);
		expect(interestSimilarity(a, b, ["bouldering"], ["bouldering"])).toBeGreaterThan(base);
		expect(interestSimilarity(a, b, ["bouldering"], ["knitting"])).toBeLessThan(base);
	});
});

describe("preferenceMatch", () => {
	it("is directional", () => {
		const wantsAttr = [100, 0, 0, 0, 0, 0];
		const highAttr = [10, 5, 5, 5, 5, 5];
		const lowAttr = [1, 5, 5, 5, 5, 5];

		expect(preferenceMatch(wantsAttr, highAttr)).toBeGreaterThan(preferenceMatch(wantsAttr, lowAttr));
	});
});

describe("geoProximity", () => {
	it("returns 0.5 when coordinates are missing", () => {
		expect(geoProximity({ latitude: null, longitude: null }, { latitude: 1, longitude: 1 })).toBe(0.5);
	});

	it("decays with distance", () => {
		const here = { latitude: 38.72, longitude: -9.14 };
		const nearby = { latitude: 38.73, longitude: -9.14 };
		const far = { latitude: 41.15, longitude: -8.61 };

		expect(geoProximity(here, nearby)).toBeGreaterThan(geoProximity(here, far));
	});
});

describe("bioSimilarity", () => {
	it("returns null when either embedding is absent", () => {
		expect(bioSimilarity(null, [1, 0])).toBeNull();
		expect(bioSimilarity([1, 0], null)).toBeNull();
	});
});

describe("unilateral and reciprocalScore", () => {
	it("scores identical rich profiles near 1", () => {
		const embedding = Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.1));
		const profile = makeProfile({
			id: 1,
			interests: Array.from({ length: 17 }, () => 8),
			pref: [20, 20, 20, 20, 10, 10],
			self: [8, 7, 7, 6, 5, 5],
			bioEmbedding: embedding,
		});
		const twin = { ...profile, id: 2 };

		const { reciprocal, pUToV, qVToU } = reciprocalScore(profile, twin);

		expect(pUToV).toBeCloseTo(1, 2);
		expect(qVToU).toBeCloseTo(1, 2);
		expect(reciprocal).toBeCloseTo(1, 2);
	});

	it("harmonic mean sits below arithmetic mean for one-sided preference fit", () => {
		const u = makeProfile({
			id: 1,
			pref: [100, 0, 0, 0, 0, 0],
			self: [1, 5, 5, 5, 5, 5],
			bioEmbedding: null,
			latitude: 38.72,
			longitude: -9.14,
		});
		const v = makeProfile({
			id: 2,
			pref: [100, 0, 0, 0, 0, 0],
			self: [10, 5, 5, 5, 5, 5],
			bioEmbedding: null,
			latitude: 38.72,
			longitude: -9.14,
		});

		const prefOnly = { bio: 0, interest: 0, geo: 0, pref: 1 };
		const { reciprocal, pUToV, qVToU } = reciprocalScore(u, v, prefOnly);
		const arithmetic = (pUToV + qVToU) / 2;

		expect(pUToV).toBeGreaterThan(qVToU + 0.3);
		expect(reciprocal).toBeLessThan(arithmetic - 0.15);
	});

	it("renormalizes weights when bio embedding is missing and stays in [0, 1]", () => {
		const u = makeProfile({ id: 1, bioEmbedding: null });
		const v = makeProfile({
			id: 2,
			bioEmbedding: Array.from({ length: 384 }, () => 1),
		});

		const score = unilateral(u, v, DEFAULT_WEIGHTS);

		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(1);

		const withBio = unilateral({ ...u, bioEmbedding: Array.from({ length: 384 }, () => 1) }, v, DEFAULT_WEIGHTS);

		expect(withBio).not.toBe(score);
	});
});

describe("crossPathsNorm", () => {
	it("is 0 for no crossings", () => {
		expect(crossPathsNorm(0)).toBe(0);
	});

	it("is monotonic and saturates below 1", () => {
		const values = [1, 2, 3, 5, 10, 50].map((count) => crossPathsNorm(count));

		for (let i = 1; i < values.length; i++) {
			expect(values[i]).toBeGreaterThan(values[i - 1]);
		}
		expect(values.at(-1)).toBeLessThan(1);
		expect(crossPathsNorm(3)).toBeCloseTo(0.632, 3);
	});
});

describe("applyCrossPathsBoost", () => {
	it("leaves the reciprocal unchanged with no crossings", () => {
		expect(applyCrossPathsBoost(0.42, 0)).toBe(0.42);
	});

	it("leaves the reciprocal unchanged at lambda 0", () => {
		expect(applyCrossPathsBoost(0.42, 7, 0)).toBe(0.42);
	});

	it("lifts a crossed candidate above an equal uncrossed one", () => {
		expect(applyCrossPathsBoost(0.5, 2)).toBeGreaterThan(applyCrossPathsBoost(0.5, 0));
	});
});

describe("scoreBreakdown", () => {
	it("splits the preference term by direction and matches reciprocalScore", () => {
		const u = makeProfile({ id: 1, pref: [100, 0, 0, 0, 0, 0], self: [1, 5, 5, 5, 5, 5] });
		const v = makeProfile({ id: 2, pref: [100, 0, 0, 0, 0, 0], self: [10, 1, 1, 1, 1, 1] });

		const breakdown = scoreBreakdown(u, v);

		expect(breakdown.prefUToV).toBeGreaterThan(breakdown.prefVToU);
		expect(breakdown.bio).toBeNull();
		expect(breakdown.reciprocal).toBeCloseTo(reciprocalScore(u, v).reciprocal, 10);
	});
});

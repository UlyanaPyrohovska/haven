import { describe, expect, it } from "vitest";
import {
	applyCrossPathsBoost,
	bioSimilarity,
	type ComponentCalibration,
	crossPathsNorm,
	DEFAULT_WEIGHTS,
	dailyAnswerSimilarity,
	geoProximity,
	interestSimilarity,
	logit,
	moodCompatibility,
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

	it("scores an empty (all-null) profile as no signal, below a real partial overlap", () => {
		const pick = (ids: number[]) => Array.from({ length: 17 }, (_, i) => (ids.includes(i) ? 10 : 1));
		const withNulls = Array.from({ length: 17 }, () => null);

		expect(interestSimilarity(pick([0, 1, 2]), withNulls)).toBe(0.5);
		expect(interestSimilarity(pick([0, 1, 2]), pick([0, 5, 6]))).toBeGreaterThan(0.5);
		expect(interestSimilarity(pick([0, 1, 2]), pick([4, 5, 6]))).toBeLessThan(0.5);
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

	it("rewards relative strengths, not inflated self-ratings", () => {
		const pref = [40, 10, 10, 10, 10, 20];

		expect(preferenceMatch(pref, [10, 10, 10, 10, 10, 10])).toBe(0.5);
		expect(preferenceMatch(pref, [9, 4, 4, 4, 4, 6])).toBeGreaterThan(0.9);
		expect(preferenceMatch(pref, [2, 9, 9, 9, 9, 5])).toBeLessThan(0.2);
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
			interests: Array.from({ length: 17 }, (_, i) => (i % 3 === 0 ? 10 : 2)),
			pref: [20, 20, 20, 20, 10, 10],
			self: [8, 8, 8, 8, 4, 4],
			bioEmbedding: embedding,
		});
		const twin = { ...profile, id: 2 };

		const { reciprocal, pUToV, qVToU } = reciprocalScore(profile, twin);

		// Clipped z-scores cap the squashed score just under 1.
		expect(pUToV).toBeGreaterThan(0.99);
		expect(qVToU).toBeGreaterThan(0.99);
		expect(reciprocal).toBeGreaterThan(0.99);
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

		const prefOnly = { bio: 0, interest: 0, geo: 0, pref: 1, mood: 0, dailyAnswer: 0 };
		const { reciprocal, pUToV, qVToU } = reciprocalScore(u, v, prefOnly);
		const arithmetic = (pUToV + qVToU) / 2;

		expect(pUToV).toBeGreaterThan(qVToU + 0.3);
		expect(reciprocal).toBeLessThan(arithmetic - 0.15);
	});

	it("renormalizes weights when bio embedding is missing and stays in [0, 1]", () => {
		const u = makeProfile({
			id: 1,
			bioEmbedding: null,
			interests: Array.from({ length: 17 }, (_, i) => (i < 9 ? 10 : 1)),
		});
		const v = makeProfile({
			id: 2,
			bioEmbedding: Array.from({ length: 384 }, () => 1),
		});

		const score = unilateral(u, v, DEFAULT_WEIGHTS);

		expect(score).toBeGreaterThanOrEqual(0);
		expect(score).toBeLessThanOrEqual(1);

		const withBio = unilateral({ ...u, bioEmbedding: Array.from({ length: 384 }, () => 1) }, v, DEFAULT_WEIGHTS);

		// Identical bios (similarity 1) lift a pair whose other terms are below 1.
		expect(withBio).toBeGreaterThan(score);
	});

	it("uses α only when both sides have an embedding (mixed pairing)", () => {
		const embedding = Array.from({ length: 384 }, (_, i) => Math.cos(i * 0.05));
		const withEmb = makeProfile({ id: 1, bioEmbedding: embedding, interests: Array.from({ length: 17 }, () => 9) });
		const withoutEmb = makeProfile({ id: 2, bioEmbedding: null });
		const otherWithEmb = { ...withoutEmb, bioEmbedding: embedding };
		const breakdown = scoreBreakdown(withEmb, otherWithEmb);
		const w = DEFAULT_WEIGHTS;
		const backbone =
			(w.interest * breakdown.interest + w.geo * breakdown.geo + w.pref * breakdown.prefUToV) /
			(w.interest + w.geo + w.pref);

		// Uncalibrated: either side missing → same renormalized backbone, in both directions.
		expect(unilateral(withEmb, withoutEmb, w, null)).toBeCloseTo(backbone, 10);
		expect(unilateral({ ...withEmb, bioEmbedding: null }, otherWithEmb, w, null)).toBeCloseTo(backbone, 10);

		// Both present → weighted sum including the bio term (mood and answer still missing, so renormalized).
		const expected =
			(w.bio * (breakdown.bio ?? 0) +
				w.interest * breakdown.interest +
				w.geo * breakdown.geo +
				w.pref * breakdown.prefUToV) /
			(w.bio + w.interest + w.geo + w.pref);
		expect(breakdown.bio).toBeCloseTo(1, 10);
		expect(unilateral(withEmb, otherWithEmb, w, null)).toBeCloseTo(expected, 10);
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

	it("shifts by lambda · norm in standardized units and stays below 1", () => {
		for (const score of [0.3, 0.5, 0.95]) {
			expect(logit(applyCrossPathsBoost(score, 3, 0.5)) - logit(score)).toBeCloseTo(0.5 * crossPathsNorm(3), 6);
		}
		expect(applyCrossPathsBoost(0.99, 1000, 3)).toBeLessThan(1);
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

describe("moodCompatibility", () => {
	it("is null when either side has no check-in", () => {
		expect(moodCompatibility(null, "happy")).toBeNull();
		expect(moodCompatibility("calm", undefined)).toBeNull();
	});

	it("is symmetric and not plain equality", () => {
		expect(moodCompatibility("calm", "stressed")).toBe(moodCompatibility("stressed", "calm"));
		expect(moodCompatibility("calm", "stressed")).toBeGreaterThan(moodCompatibility("low", "low") as number);
	});
});

describe("dailyAnswerSimilarity", () => {
	it("is null when either side has no answer or only filler words", () => {
		expect(dailyAnswerSimilarity(null, "Coffee with a friend")).toBeNull();
		expect(dailyAnswerSimilarity("the and", "Coffee with a friend")).toBeNull();
	});

	it("is neutral (0.5) with no overlap and 1 for the same answer", () => {
		expect(dailyAnswerSimilarity("Sunset from the hill", "Coffee with a friend")).toBe(0.5);
		expect(dailyAnswerSimilarity("Coffee with a friend", "coffee, with a FRIEND!")).toBe(1);
	});

	it("rises with shared words", () => {
		const some = dailyAnswerSimilarity("Coffee with an old friend", "Coffee at the bakery") as number;

		expect(some).toBeGreaterThan(0.5);
		expect(some).toBeLessThan(1);
	});
});

describe("unilateral with mood and daily answer", () => {
	it("treats missing mood and answer as neutral instead of scoring them as zero", () => {
		const u = makeProfile({ id: 1 });
		const v = makeProfile({ id: 2 });
		const base = unilateral(u, v);

		expect(unilateral({ ...u, mood: "happy" }, v)).toBeCloseTo(base, 10);
		expect(unilateral(u, { ...v, dailyAnswer: "A long walk" })).toBeCloseTo(base, 10);
	});

	it("adds both terms as offsets from neutral when both sides have them", () => {
		const u = makeProfile({ id: 1, mood: "happy", dailyAnswer: "A long walk by the sea" });
		const v = makeProfile({ id: 2, mood: "excited", dailyAnswer: "Swimming in the sea" });
		const b = scoreBreakdown(u, v);
		const w = DEFAULT_WEIGHTS;
		const profileWeight = w.interest + w.geo + w.pref;
		const expected =
			(w.interest * b.interest + w.geo * b.geo + w.pref * b.prefUToV) / profileWeight +
			(w.mood * ((b.mood as number) - 0.5) + w.dailyAnswer * ((b.dailyAnswer as number) - 0.5)) /
				(profileWeight + w.mood + w.dailyAnswer);

		expect(b.dailyAnswer).toBeGreaterThan(0.5);
		expect(unilateral(u, v, w, null)).toBeCloseTo(expected, 10);
	});

	it.each([
		["calibrated", undefined],
		["uncalibrated", null],
	] as const)("never lowers a score for a low mood or an answer with no shared words (%s)", (_, calibration) => {
		const u = makeProfile({ id: 1 });
		const v = makeProfile({ id: 2 });
		const score = (a: ScoringProfile, b: ScoringProfile) => unilateral(a, b, DEFAULT_WEIGHTS, calibration);
		const base = score(u, v);

		expect(score({ ...u, mood: "low" }, { ...v, mood: "low" })).toBeCloseTo(base, 10);
		expect(score({ ...u, dailyAnswer: "Pizza night" }, { ...v, dailyAnswer: "Long mountain hike" })).toBeCloseTo(
			base,
			10,
		);
	});
});

describe("calibrated unilateral", () => {
	const calibration: ComponentCalibration = {
		interest: { mean: 0.5, sd: 0.1 },
		geo: { mean: 0.5, sd: 0.4 },
		pref: { mean: 0.5, sd: 0.2 },
		bio: { mean: 0.6, sd: 0.1 },
		mood: { mean: 0.5, sd: 0.2 },
		dailyAnswer: { mean: 0.55, sd: 0.1 },
	};
	const pick = (ids: number[]) => Array.from({ length: 17 }, (_, i) => (ids.includes(i) ? 10 : 1));

	it("scores a pair at every component mean as 0.5, and missing data the same", () => {
		const u = makeProfile({ id: 1, latitude: null, longitude: null });
		const v = makeProfile({ id: 2, latitude: null, longitude: null });

		// Flat interests and preferences give 0.5, missing geo gives 0.5, bio is missing.
		expect(unilateral(u, v, DEFAULT_WEIGHTS, calibration)).toBeCloseTo(0.5, 10);
	});

	it("gives the same raw gain more influence when the component's population spread is smaller", () => {
		const u = makeProfile({ id: 1, interests: pick([0, 1, 2]) });
		const v = makeProfile({ id: 2, interests: pick([0, 1, 3]) });
		const narrow = unilateral(u, v, DEFAULT_WEIGHTS, calibration);
		const wide = unilateral(u, v, DEFAULT_WEIGHTS, { ...calibration, interest: { mean: 0.5, sd: 0.4 } });

		expect(scoreBreakdown(u, v).interest).toBeGreaterThan(0.5);
		expect(narrow).toBeGreaterThan(wide);
	});

	it("keeps calibration = null as the uncalibrated ablation", () => {
		const u = makeProfile({ id: 1, interests: pick([0, 1, 2]) });
		const v = makeProfile({ id: 2, interests: pick([0, 1, 9]) });
		const b = scoreBreakdown(u, v);
		const w = DEFAULT_WEIGHTS;

		expect(unilateral(u, v, w, null)).toBeCloseTo(
			(w.interest * b.interest + w.geo * b.geo + w.pref * b.prefUToV) / (w.interest + w.geo + w.pref),
			10,
		);
	});
});

describe("z clipping", () => {
	it("caps how far one rare perfect component can lift the score", () => {
		const u = makeProfile({ id: 1, dailyAnswer: "Coffee with a friend" });
		const v = makeProfile({ id: 2, dailyAnswer: "coffee with a friend" });
		const base = unilateral(makeProfile({ id: 1 }), makeProfile({ id: 2 }));
		const norm = Math.sqrt(Object.values(DEFAULT_WEIGHTS).reduce((sum, w) => sum + w * w, 0));
		const logit = (p: number) => Math.log(p / (1 - p));

		// Identical answers sit ~7σ out; clipped, they add at most 3 · w / norm to the standardized sum.
		expect(logit(unilateral(u, v)) - logit(base)).toBeCloseTo((3 * DEFAULT_WEIGHTS.dailyAnswer) / norm, 10);
	});
});

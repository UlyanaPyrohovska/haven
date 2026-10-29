import { describe, expect, it } from "vitest";
import { exposurePenalty, gini, rerankForExposure } from "@/lib/fairness";

const ranked = [
	{ candidateId: 1, score: 0.9 },
	{ candidateId: 2, score: 0.8 },
	{ candidateId: 3, score: 0.7 },
];

describe("exposurePenalty", () => {
	it("leaves unseen candidates alone and shrinks monotonically with exposure", () => {
		expect(exposurePenalty(0.8, 0, 0.3)).toBe(0.8);
		expect(exposurePenalty(0.8, 2, 0.3)).toBeLessThan(0.8);
		expect(exposurePenalty(0.8, 10, 0.3)).toBeLessThan(exposurePenalty(0.8, 2, 0.3));
		expect(exposurePenalty(0.8, 1e9, 0.3)).toBeGreaterThanOrEqual(0.8 * 0.7);
	});
});

describe("rerankForExposure", () => {
	const exposures = new Map([[1, 20]]);

	it("is the identity at mu = 0 with no cap", () => {
		expect(rerankForExposure(ranked, exposures, 3, { mu: 0, cap: null })).toEqual(ranked);
	});

	it("lets the penalty displace an over-exposed candidate", () => {
		const [first] = rerankForExposure(ranked, exposures, 3, { mu: 0.5, cap: null });

		expect(first.candidateId).toBe(2);
		expect(first.score).toBe(0.8);
	});

	it("puts capped candidates last but still fills k", () => {
		const result = rerankForExposure(ranked, new Map([[1, 3]]), 3, { mu: 0, cap: 3 });

		expect(result.map((row) => row.candidateId)).toEqual([2, 3, 1]);
		expect(rerankForExposure(ranked, new Map([[1, 3]]), 2, { mu: 0, cap: 3 }).map((row) => row.candidateId)).toEqual([
			2, 3,
		]);
	});

	it("keeps exempt ids first, uncapped and unpenalized", () => {
		const result = rerankForExposure(ranked, new Map([[3, 99]]), 1, { mu: 1, cap: 1 }, new Set([3]));

		expect(result.map((row) => row.candidateId)).toEqual([3]);
	});
});

describe("gini", () => {
	it("is 0 for equal exposure and high for concentrated exposure", () => {
		expect(gini([])).toBe(0);
		expect(gini([1, 1, 1])).toBeCloseTo(0);
		expect(gini([0, 0, 9])).toBeCloseTo(2 / 3);
	});
});

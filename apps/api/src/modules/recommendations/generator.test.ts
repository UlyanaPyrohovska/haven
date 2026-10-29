import { describe, expect, it } from "vitest";
import { rerankForExposure } from "@/lib/fairness";
import { reciprocalScore, type ScoringProfile } from "@/lib/scoring";
import { rankCandidates } from "./generator";

function makeProfile(id: number, overrides: Partial<ScoringProfile> = {}): ScoringProfile {
	return {
		id,
		interests: Array.from({ length: 17 }, () => 5),
		pref: Array.from({ length: 6 }, () => 100 / 6),
		self: Array.from({ length: 6 }, () => 5),
		latitude: 38.5244,
		longitude: -8.8882,
		bioEmbedding: null,
		...overrides,
	};
}

const viewer = makeProfile(1);

describe("rankCandidates", () => {
	it("ranks a crossed candidate above an equal-reciprocal uncrossed one", () => {
		const pool = [makeProfile(2), makeProfile(3)];
		const ranked = rankCandidates(viewer, pool, new Map([[3, { count: 4 }]]), 2);

		expect(ranked.map((row) => row.candidateId)).toEqual([3, 2]);
		expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
	});

	it("does not boost a candidate missing from the counts (no row or opted out)", () => {
		const candidate = makeProfile(2);
		const [row] = rankCandidates(viewer, [candidate], new Map(), 1);

		expect(row.score).toBe(reciprocalScore(viewer, candidate).reciprocal);
	});

	it("reproduces the pure reciprocal order at lambda 0", () => {
		const pool = [
			makeProfile(2, { latitude: 38.9, longitude: -9.3 }),
			makeProfile(3),
			makeProfile(4, { latitude: 38.6, longitude: -8.9 }),
		];
		const counts = new Map([
			[2, { count: 9 }],
			[4, { count: 3 }],
		]);
		const baseline = pool
			.map((candidate) => ({ candidateId: candidate.id, score: reciprocalScore(viewer, candidate).reciprocal }))
			.sort((a, b) => b.score - a.score);

		expect(rankCandidates(viewer, pool, counts, 3, undefined, 0)).toEqual(baseline);
	});

	it("puts a pending liker first even when it scores lower", () => {
		const pool = [makeProfile(2), makeProfile(3, { latitude: 40.0, longitude: -3.7 })];
		const ranked = rankCandidates(viewer, pool, new Map(), 1, undefined, undefined, new Set([3]));

		expect(ranked.map((row) => row.candidateId)).toEqual([3]);
	});

	it("keeps only the top k", () => {
		const pool = [makeProfile(2), makeProfile(3), makeProfile(4)];

		expect(rankCandidates(viewer, pool, new Map(), 2)).toHaveLength(2);
	});
});

describe("rankCandidates + rerankForExposure", () => {
	const pool = [makeProfile(2), makeProfile(3, { latitude: 38.9, longitude: -9.3 })];
	const full = rankCandidates(viewer, pool, new Map(), Number.POSITIVE_INFINITY);

	it("swaps out the top candidate once it hits the exposure cap", () => {
		expect(full[0].candidateId).toBe(2);
		expect(rerankForExposure(full, new Map([[2, 5]]), 1, { mu: 0, cap: 5 })[0].candidateId).toBe(3);
	});

	it("reproduces the unfair ranking at mu 0 with no cap", () => {
		expect(rerankForExposure(full, new Map([[2, 50]]), 2, { mu: 0, cap: null })).toEqual(full);
	});
});

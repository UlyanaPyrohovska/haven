import { describe, expect, it } from "vitest";
import type { ScoringProfile } from "@/lib/matching/scoring";
import { AGENT, acceptProbability, agentAccepts, hiddenProfile, seededRandom } from "./agent-decision";
import { AGENT_BASE_WEIGHTS, agentUtility } from "./agent-utility";

describe("acceptProbability", () => {
	it("is 0.5 at the threshold and monotonic in score", () => {
		expect(acceptProbability(AGENT.threshold)).toBeCloseTo(0.5);
		expect(acceptProbability(0.3)).toBeLessThan(acceptProbability(0.5));
		expect(acceptProbability(0.5)).toBeLessThan(acceptProbability(0.8));
	});
});

describe("seededRandom", () => {
	it("is stable per seed and stays in [0, 1)", () => {
		expect(seededRandom("t1:1:2")).toBe(seededRandom("t1:1:2"));
		expect(seededRandom("t1:1:2")).not.toBe(seededRandom("t1:2:1"));

		for (let i = 0; i < 1000; i++) {
			const value = seededRandom(`seed-${i}`);
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});
});

describe("agentAccepts", () => {
	const rate = (score: number) => {
		let accepted = 0;
		for (let i = 0; i < 2000; i++) {
			if (agentAccepts(score, `rate:${i}`)) accepted++;
		}
		return accepted / 2000;
	};

	it("almost never accepts far below the threshold and almost always far above", () => {
		expect(rate(0.1)).toBeLessThan(0.01);
		expect(rate(0.95)).toBeGreaterThan(0.99);
	});

	it("accepts roughly half the time at the threshold", () => {
		expect(rate(AGENT.threshold)).toBeGreaterThan(0.4);
		expect(rate(AGENT.threshold)).toBeLessThan(0.6);
	});
});

describe("hiddenProfile", () => {
	const agent: ScoringProfile = {
		id: 7,
		interests: [10, 1, 8, null, 3, 10, 1, 1, 5, 9, 2, 2, 7, 1, 1, 10, 4],
		pref: [30, 20, 20, 10, 10, null],
		self: [6, 7, 5, 8, 4, 6],
		latitude: null,
		longitude: null,
		bioEmbedding: null,
	};
	const other: ScoringProfile = { ...agent, id: 8, interests: agent.interests.map((v) => (v ?? 5) % 7) };

	it("is the stored profile at noise 0", () => {
		const { profile, weights } = hiddenProfile(agent, 0);
		expect(agentUtility(profile, other, weights)).toBeCloseTo(agentUtility(agent, other, AGENT_BASE_WEIGHTS));
	});

	it("is stable per agent and differs from what the recommender sees", () => {
		const a = hiddenProfile(agent);
		expect(hiddenProfile(agent)).toEqual(a);
		expect(a.profile.pref).not.toEqual(agent.pref);
		expect(a.weights).not.toEqual(AGENT_BASE_WEIGHTS);
		expect(hiddenProfile({ ...agent, id: 9 }).profile.interests).not.toEqual(a.profile.interests);
	});
});

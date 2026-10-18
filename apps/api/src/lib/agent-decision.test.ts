import { describe, expect, it } from "vitest";
import { AGENT, acceptProbability, agentAccepts, seededRandom } from "./agent-decision";

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

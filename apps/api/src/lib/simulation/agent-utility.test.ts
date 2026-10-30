import { describe, expect, it } from "vitest";
import type { ScoringProfile } from "@/lib/matching/scoring";
import { agentUtility } from "@/lib/simulation/agent-utility";

const pick = (ids: number[]) => Array.from({ length: 17 }, (_, i) => (ids.includes(i) ? 10 : 1));

const u: ScoringProfile = {
	id: 1,
	interests: pick([0, 1, 2]),
	pref: [40, 10, 10, 10, 10, 20],
	self: [7, 7, 7, 7, 7, 7],
	latitude: 52.5,
	longitude: 13.4,
	bioEmbedding: null,
};
const v: ScoringProfile = { ...u, id: 2, interests: pick([0, 1, 9]) };

describe("agentUtility (frozen a7ad2c3 formula)", () => {
	it("reproduces the pinned pre-fix values", () => {
		expect(agentUtility(u, v)).toBeCloseTo(0.83729, 4);
		expect(
			agentUtility({ ...u, dailyAnswer: "pizza night with friends" }, { ...v, dailyAnswer: "long hike mountains" }),
		).toBeCloseTo(0.7854, 4);
		expect(agentUtility({ ...u, mood: "low" }, { ...v, mood: "low" })).toBeCloseTo(0.78418, 4);
	});
});

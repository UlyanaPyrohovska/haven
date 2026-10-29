import { describe, expect, it } from "vitest";
import { blendPreference, learnedPreference, type PreferenceDecision } from "@/lib/preference-learning";
import { preferenceMatch } from "@/lib/scoring";

const stated = [100 / 6, 100 / 6, 100 / 6, 100 / 6, 100 / 6, 100 / 6];
const attractive = [10, 5, 5, 5, 5, 5];
const ambitious = [5, 5, 5, 5, 10, 5];
const sum = (values: readonly (number | null)[]) => values.reduce<number>((total, value) => total + (value ?? 0), 0);

describe("learnedPreference", () => {
	it("is null without a like", () => {
		expect(learnedPreference([])).toBeNull();
		expect(learnedPreference([{ self: attractive, liked: false }])).toBeNull();
	});

	it("is a 100-point split pulled toward liked and away from passed traits", () => {
		const learned = learnedPreference([
			{ self: attractive, liked: true },
			{ self: ambitious, liked: false },
		]) as number[];

		expect(sum(learned)).toBeCloseTo(100);
		expect(Math.min(...learned)).toBeGreaterThan(0);
		expect(learned[0]).toBeGreaterThan(learned[1]);
		expect(learned[4]).toBeLessThan(learned[1]);
	});

	it("treats missing self-ratings as neutral", () => {
		const learned = learnedPreference([{ self: [null, null, null, null, null, null], liked: true }]) as number[];

		for (const value of learned) {
			expect(value).toBeCloseTo(100 / 6);
		}
	});
});

describe("blendPreference", () => {
	const decisions: PreferenceDecision[] = [{ self: attractive, liked: true }];

	it("returns stated untouched at lambda 0 or without decisions", () => {
		expect(blendPreference(stated, decisions, 0)).toBe(stated);
		expect(blendPreference(stated, [])).toBe(stated);
	});

	it("shifts more toward the learned vector as decisions accumulate", () => {
		const few = blendPreference(stated, decisions) as number[];
		const many = blendPreference(stated, Array(50).fill(decisions[0])) as number[];

		expect(sum(few)).toBeCloseTo(100);
		expect(few[0]).toBeGreaterThan(stated[0]);
		expect(many[0]).toBeGreaterThan(few[0]);
	});

	it("recovers a hidden taste better than the stated split", () => {
		let seed = 42;
		const random = () => {
			seed = (seed * 1103515245 + 12345) % 2 ** 31;
			return seed / 2 ** 31;
		};
		const hidden = [40, 10, 10, 10, 20, 10];
		const decisions: PreferenceDecision[] = Array.from({ length: 60 }, () => {
			const self = Array.from({ length: 6 }, () => 1 + Math.round(9 * random()));
			return { self, liked: preferenceMatch(hidden, self) > 0.9 };
		});
		const blended = blendPreference(stated, decisions) as number[];

		expect(preferenceMatch(blended, hidden)).toBeGreaterThan(preferenceMatch(stated, hidden));
	});
});

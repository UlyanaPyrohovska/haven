import { describe, expect, it } from "vitest";
import {
	type LearnedPreference,
	learnedPreference,
	learnPreference,
	PREFERENCE_LEARNING,
	type PreferenceDecision,
} from "@/lib/preference-learning";
import { directedPreferenceMatch, preferenceMatch } from "@/lib/scoring";

const stated = [100 / 6, 100 / 6, 100 / 6, 100 / 6, 100 / 6, 100 / 6];
const attractive = [10, 5, 5, 5, 5, 5];
const ambitious = [5, 5, 5, 5, 10, 5];
const like = (self: number[]): PreferenceDecision => ({ self, liked: true });
const pass = (self: number[]): PreferenceDecision => ({ self, liked: false });

describe("learnedPreference", () => {
	it("is null without a like", () => {
		expect(learnedPreference([])).toBeNull();
		expect(learnedPreference([pass(attractive)])).toBeNull();
	});

	it("points toward liked and away from passed traits", () => {
		const learned = learnedPreference([like(attractive), pass(ambitious)]) as number[];

		expect(learned[0]).toBeGreaterThan(learned[1]);
		expect(learned[4]).toBeLessThan(learned[1]);
	});

	it("learns nothing when likes look like everything decided on (population shape cancels)", () => {
		const typical = [6, 9, 8, 7, 5, 6];

		expect(learnedPreference([like(typical), like(typical), pass(typical)])).toBeNull();
		expect(learnedPreference([like(attractive), like(attractive)])).toBeNull();
	});

	it("ignores rating level, only relative strengths", () => {
		const inflated = learnedPreference([like([10, 9, 9, 9, 9, 9]), pass([5, 5, 5, 5, 9, 5])]) as number[];
		const modest = learnedPreference([like([4, 3, 3, 3, 3, 3]), pass([5, 5, 5, 5, 9, 5])]) as number[];

		inflated.forEach((value, i) => {
			expect(value).toBeCloseTo(modest[i], 10);
		});
	});
});

describe("learnPreference", () => {
	const decisions: PreferenceDecision[] = [like(attractive), pass(ambitious)];

	it("is null at lambda 0 or without decisions", () => {
		expect(learnPreference(decisions, 0)).toBeNull();
		expect(learnPreference([])).toBeNull();
	});

	it("grows its share as decisions accumulate", () => {
		const few = learnPreference(decisions) as LearnedPreference;
		const many = learnPreference(Array.from({ length: 25 }, () => decisions).flat()) as LearnedPreference;

		expect(few.share).toBeGreaterThan(0);
		expect(many.share).toBeGreaterThan(few.share);
		expect(many.share).toBeLessThan(PREFERENCE_LEARNING.lambda);
	});

	it("gives a weak contrast a smaller share than a strong one at the same n", () => {
		const mild = [6, 5, 5, 5, 5, 5];
		const weak = learnPreference([like(mild), pass([5, 6, 5, 5, 5, 5]), pass(mild), like([5, 6, 5, 5, 5, 5])]);
		const strong = learnPreference([like(attractive), pass(ambitious), like(attractive), pass(ambitious)]);

		expect(weak === null || weak.share < (strong as LearnedPreference).share).toBe(true);
	});

	it("keeps a flat stated preference near neutral after two decisions", () => {
		const learned = learnPreference(decisions) as LearnedPreference;
		const viewer = { pref: stated, learnedPref: learned.direction, learnedShare: learned.share };

		expect(Math.abs(directedPreferenceMatch(viewer, { self: attractive }) - 0.5)).toBeLessThan(0.1);
	});

	it("recovers a hidden taste better than the stated split", () => {
		let seed = 42;
		const random = () => {
			seed = (seed * 1103515245 + 12345) % 2 ** 31;
			return seed / 2 ** 31;
		};
		const hidden = [40, 10, 10, 10, 20, 10];
		const history: PreferenceDecision[] = Array.from({ length: 60 }, () => {
			const self = Array.from({ length: 6 }, () => 1 + Math.round(9 * random()));
			return { self, liked: preferenceMatch(hidden, self) > 0.7 };
		});
		const learned = learnPreference(history) as LearnedPreference;

		expect(preferenceMatch(learned.direction, hidden)).toBeGreaterThan(0.8);
		expect(preferenceMatch(learned.direction, hidden)).toBeGreaterThan(preferenceMatch(stated, hidden));
	});
});

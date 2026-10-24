import { describe, expect, it } from "vitest";
import { ageFromBirthDate } from "@/lib/age";
import {
	birthDateWindow,
	isValidAgeRange,
	mutualFilterMatch,
	type PartnerFilterProfile,
	passesFilters,
} from "@/lib/partner-filters";

const TODAY = new Date(Date.UTC(2026, 9, 19));

function profile(overrides: Partial<PartnerFilterProfile> = {}): PartnerFilterProfile {
	return { gender: 0, birthDate: null, interestedIn: null, prefAgeMin: null, prefAgeMax: null, ...overrides };
}

function bornAgo(years: number, dayOffset = 0): Date {
	return new Date(Date.UTC(TODAY.getUTCFullYear() - years, TODAY.getUTCMonth(), TODAY.getUTCDate() + dayOffset));
}

describe("passesFilters", () => {
	it("lets everyone through when the viewer has no filters", () => {
		expect(passesFilters(profile(), profile({ gender: 2, birthDate: bornAgo(60) }), TODAY)).toBe(true);
	});

	it("treats an empty interestedIn as open to all", () => {
		expect(passesFilters(profile({ interestedIn: [] }), profile({ gender: 1 }), TODAY)).toBe(true);
	});

	it("filters by gender", () => {
		const viewer = profile({ interestedIn: [0, 2] });

		expect(passesFilters(viewer, profile({ gender: 2 }), TODAY)).toBe(true);
		expect(passesFilters(viewer, profile({ gender: 1 }), TODAY)).toBe(false);
	});

	it("passes candidates with unknown gender or birth date", () => {
		const viewer = profile({ interestedIn: [1], prefAgeMin: 30, prefAgeMax: 35 });

		expect(passesFilters(viewer, profile({ gender: null, birthDate: null }), TODAY)).toBe(true);
	});

	it("includes both age bounds", () => {
		const viewer = profile({ prefAgeMin: 25, prefAgeMax: 30 });

		expect(passesFilters(viewer, profile({ birthDate: bornAgo(25) }), TODAY)).toBe(true);
		expect(passesFilters(viewer, profile({ birthDate: bornAgo(25, 1) }), TODAY)).toBe(false);
		expect(passesFilters(viewer, profile({ birthDate: bornAgo(31, 1) }), TODAY)).toBe(true);
		expect(passesFilters(viewer, profile({ birthDate: bornAgo(31) }), TODAY)).toBe(false);
	});
});

describe("mutualFilterMatch", () => {
	it("requires both sides to fit", () => {
		const woman = profile({ gender: 0, birthDate: bornAgo(28), interestedIn: [1] });
		const manIntoWomen = profile({ gender: 1, birthDate: bornAgo(30), interestedIn: [0] });
		const manIntoMen = profile({ gender: 1, birthDate: bornAgo(30), interestedIn: [1] });

		expect(mutualFilterMatch(woman, manIntoWomen, TODAY)).toBe(true);
		expect(mutualFilterMatch(woman, manIntoMen, TODAY)).toBe(false);
	});

	it("fails when the other side's age range excludes the viewer", () => {
		const a = profile({ birthDate: bornAgo(40) });
		const b = profile({ birthDate: bornAgo(25), prefAgeMax: 30 });

		expect(mutualFilterMatch(a, b, TODAY)).toBe(false);
	});
});

describe("birthDateWindow", () => {
	it("agrees with ageFromBirthDate at the edges", () => {
		const { latest, earliestExclusive } = birthDateWindow(25, 30, TODAY);

		expect(latest).not.toBeNull();
		expect(earliestExclusive).not.toBeNull();
		expect(ageFromBirthDate(new Date(`${latest}T00:00:00Z`), TODAY)).toBe(25);
		expect(ageFromBirthDate(new Date(`${earliestExclusive}T00:00:00Z`), TODAY)).toBe(31);
	});

	it("returns nulls for open bounds", () => {
		expect(birthDateWindow(null, null, TODAY)).toEqual({ latest: null, earliestExclusive: null });
	});
});

describe("isValidAgeRange", () => {
	it("rejects min above max only", () => {
		expect(isValidAgeRange(30, 25)).toBe(false);
		expect(isValidAgeRange(25, 25)).toBe(true);
		expect(isValidAgeRange(null, 25)).toBe(true);
	});
});

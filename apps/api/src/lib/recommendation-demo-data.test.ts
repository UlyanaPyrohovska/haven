import { describe, expect, it } from "vitest";
import { displayNameForCandidate } from "@/lib/recommendation-demo-data";

describe("displayNameForCandidate", () => {
	it("keeps curated demo names for mockup ids", () => {
		expect(displayNameForCandidate({ id: 298, isSynthetic: true })).toBe("Anna");
	});

	it("assigns a stable first name for other synthetic ids", () => {
		const name = displayNameForCandidate({ id: 392, gender: 0, isSynthetic: true });

		expect(name).not.toMatch(/^Profile \d+$/);
		expect(displayNameForCandidate({ id: 392, gender: 0, isSynthetic: true })).toBe(name);
	});

	it("uses Someone for real profiles without a stored name", () => {
		expect(displayNameForCandidate({ id: 2002, isSynthetic: false })).toBe("Someone");
	});
});

import { describe, expect, it } from "vitest";
import { displayNameForCandidate, displayNameFromAuthName, syntheticDisplayName } from "@/lib/candidate-display";

describe("displayNameForCandidate", () => {
	it("uses stored display_name when present", () => {
		expect(displayNameForCandidate({ id: 298, displayName: "Uliana", isSynthetic: false })).toBe("Uliana");
	});

	it("assigns a stable synthetic name when display_name is missing", () => {
		const name = displayNameForCandidate({ id: 392, gender: 0, isSynthetic: true });

		expect(name).not.toMatch(/^Profile \d+$/);
		expect(displayNameForCandidate({ id: 392, gender: 0, isSynthetic: true })).toBe(name);
		expect(name).toBe(syntheticDisplayName({ id: 392, gender: 0 }));
	});

	it("uses Someone for real profiles without a stored name", () => {
		expect(displayNameForCandidate({ id: 2002, isSynthetic: false })).toBe("Someone");
	});
});

describe("displayNameFromAuthName", () => {
	it("takes the first token of the auth name", () => {
		expect(displayNameFromAuthName("Anna Silva")).toBe("Anna");
	});
});

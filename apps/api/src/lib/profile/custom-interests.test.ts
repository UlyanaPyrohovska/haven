import { describe, expect, it } from "vitest";
import { containsBlockedWord, customInterestError, dedupeCustomInterests } from "./custom-interests";

describe("customInterestError", () => {
	it("accepts normal labels", () => {
		expect(customInterestError("Rock climbing")).toBeNull();
		expect(customInterestError("Scunthorpe United")).toBeNull();
	});

	it("rejects bad length, no letters, and blocked words", () => {
		expect(customInterestError(" a ")).not.toBeNull();
		expect(customInterestError("x".repeat(31))).not.toBeNull();
		expect(customInterestError("12345")).not.toBeNull();
		expect(customInterestError("watching porn")).not.toBeNull();
		expect(containsBlockedWord("Sh1t posting")).toBe(true);
	});
});

describe("dedupeCustomInterests", () => {
	it("dedupes case- and whitespace-insensitively, keeping the first spelling", () => {
		expect(dedupeCustomInterests(["Rock  Climbing", "rock climbing ", "Chess"])).toEqual(["Rock Climbing", "Chess"]);
	});
});

import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_LENGTH, normalizeMessageBody, syntheticOpener } from "@/lib/chat";

describe("normalizeMessageBody", () => {
	it("trims and collapses blank lines", () => {
		expect(normalizeMessageBody("  hi\n\n\n\nthere  ")).toBe("hi\n\nthere");
	});

	it("rejects empty and over-long bodies", () => {
		expect(normalizeMessageBody("   ")).toBeNull();
		expect(normalizeMessageBody("a".repeat(MESSAGE_MAX_LENGTH + 1))).toBeNull();
		expect(normalizeMessageBody("a".repeat(MESSAGE_MAX_LENGTH))).not.toBeNull();
	});
});

describe("syntheticOpener", () => {
	it("is deterministic for the same seed", () => {
		expect(syntheticOpener(["Music", "Hiking"], 42)).toBe(syntheticOpener(["Music", "Hiking"], 42));
	});

	it("mentions a shared interest when there is one", () => {
		const opener = syntheticOpener(["Hiking"], 7);
		expect(opener).toContain("hiking");
	});

	it("falls back to a generic opener", () => {
		expect(syntheticOpener([], 7).length).toBeGreaterThan(0);
	});
});

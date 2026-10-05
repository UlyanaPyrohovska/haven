import { describe, expect, it } from "vitest";
import {
	CADENCE,
	coerceLastShownAt,
	isCooldownElapsed,
	nextRefreshAtIso,
	resolveRecCooldownHours,
} from "@/lib/recommendation-cadence";

describe("resolveRecCooldownHours", () => {
	it("defaults to CADENCE.cooldownHours", () => {
		expect(resolveRecCooldownHours(undefined)).toBe(CADENCE.cooldownHours);
		expect(resolveRecCooldownHours("")).toBe(CADENCE.cooldownHours);
	});

	it("parses env override", () => {
		expect(resolveRecCooldownHours("0")).toBe(0);
		expect(resolveRecCooldownHours("6")).toBe(6);
	});
});

describe("isCooldownElapsed", () => {
	it("treats missing last batch as ready", () => {
		expect(isCooldownElapsed(null, 24)).toBe(true);
	});

	it("respects cooldown window", () => {
		const lastShown = new Date("2026-01-01T12:00:00.000Z");
		const inside = lastShown.getTime() + 60 * 60 * 1000;

		expect(isCooldownElapsed(lastShown, 24, inside)).toBe(false);
		expect(isCooldownElapsed(lastShown, 24, lastShown.getTime() + 25 * 60 * 60 * 1000)).toBe(true);
	});
});

describe("nextRefreshAtIso", () => {
	it("adds cooldown hours to last shown", () => {
		const lastShown = new Date("2026-01-01T12:00:00.000Z");

		expect(nextRefreshAtIso(lastShown, 24)).toBe("2026-01-02T12:00:00.000Z");
	});

	it("accepts postgres timestamp strings from max(shown_at)", () => {
		const lastShown = "2026-10-05 19:47:53.346735";

		expect(() => nextRefreshAtIso(lastShown, 24)).not.toThrow();
		expect(coerceLastShownAt(lastShown)?.toISOString()).toBeDefined();
	});
});

describe("isCooldownElapsed with string timestamps", () => {
	it("compares cooldown using coerced time", () => {
		const lastShown = "2026-01-01T12:00:00.000Z";
		const inside = Date.parse("2026-01-01T13:00:00.000Z");

		expect(isCooldownElapsed(lastShown, 24, inside)).toBe(false);
	});
});

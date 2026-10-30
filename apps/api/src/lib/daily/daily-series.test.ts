import { describe, expect, it } from "vitest";
import { fillDailySeries, lastUtcDays } from "@/lib/daily/daily-series";

describe("lastUtcDays", () => {
	it("ends on today and crosses month boundaries", () => {
		expect(lastUtcDays("2026-03-02", 3)).toEqual(["2026-02-28", "2026-03-01", "2026-03-02"]);
	});
});

describe("fillDailySeries", () => {
	it("fills missing days with 0 and drops days outside the window", () => {
		const rows = [
			{ day: "2026-03-01", count: 4 },
			{ day: "2026-01-01", count: 9 },
		];

		expect(fillDailySeries(rows, "2026-03-02", 3)).toEqual([
			{ day: "2026-02-28", count: 0 },
			{ day: "2026-03-01", count: 4 },
			{ day: "2026-03-02", count: 0 },
		]);
	});
});

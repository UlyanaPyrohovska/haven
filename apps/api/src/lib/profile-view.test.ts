import { describe, expect, it } from "vitest";
import { coarseDistanceLabel, isProfileComplete } from "@/lib/profile-view";

describe("isProfileComplete", () => {
	it("accepts real onboarding rows where selfShar is null", () => {
		expect(
			isProfileComplete({
				interestSports: 10,
				prefAttr: 20,
				prefSinc: 20,
				prefIntel: 20,
				prefFun: 20,
				prefAmb: 10,
				prefShar: 10,
				selfAttr: 7,
				selfSinc: 6,
				selfIntel: 8,
				selfFun: 5,
				selfAmb: 4,
				selfShar: null,
			}),
		).toBe(true);
	});

	it("rejects profiles missing a self-rating step", () => {
		expect(
			isProfileComplete({
				interestSports: 10,
				prefAttr: 20,
				prefSinc: 20,
				prefIntel: 20,
				prefFun: 20,
				prefAmb: 10,
				prefShar: 10,
				selfAttr: 7,
				selfSinc: null,
				selfIntel: 8,
				selfFun: 5,
				selfAmb: 4,
			}),
		).toBe(false);
	});
});

describe("coarseDistanceLabel", () => {
	it("buckets distances", () => {
		expect(coarseDistanceLabel(0.3)).toBe("Less than 1 km away");
		expect(coarseDistanceLabel(3.4)).toBe("3 km away");
		expect(coarseDistanceLabel(23)).toBe("25 km away");
	});
});

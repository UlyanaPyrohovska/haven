import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/profile/profile-view";
import { boundingBox, crossedIds, crossingBlockers, crossingPair } from "./crossings";

const setubal = { latitude: 38.5244, longitude: -8.8882 };

describe("crossingPair", () => {
	it("orders the pair", () => {
		expect(crossingPair(9, 3)).toEqual({ userA: 3, userB: 9 });
		expect(crossingPair(3, 9)).toEqual({ userA: 3, userB: 9 });
	});
});

describe("crossedIds", () => {
	it("keeps only people within the radius with known coordinates", () => {
		const others = [
			{ id: 1, latitude: 38.528, longitude: -8.8882 }, // ~0.4 km
			{ id: 2, latitude: 38.56, longitude: -8.8882 }, // ~4 km
			{ id: 3, latitude: null, longitude: null },
		];

		expect(crossedIds(setubal, others)).toEqual([1]);
	});

	it("is empty when the viewer has no coordinates", () => {
		expect(crossedIds({ latitude: null, longitude: null }, [{ id: 1, ...setubal }])).toEqual([]);
	});
});

describe("boundingBox", () => {
	it("contains points on the radius in every direction", () => {
		const box = boundingBox(setubal.latitude, setubal.longitude, 1);
		expect(haversineKm(setubal.latitude, setubal.longitude, box.maxLat, setubal.longitude)).toBeGreaterThanOrEqual(
			0.99,
		);
		expect(haversineKm(setubal.latitude, setubal.longitude, setubal.latitude, box.maxLon)).toBeGreaterThanOrEqual(0.99);
	});
});

describe("crossingBlockers", () => {
	const now = new Date("2026-10-26T12:00:00Z");
	const side = {
		lookingFor: 1,
		shareCrossPaths: true,
		locationHidden: false,
		...setubal,
		locationUpdatedAt: new Date("2026-10-26T11:50:00Z"),
	};

	it("is empty when both can cross", () => {
		expect(crossingBlockers(side, side, now)).toEqual([]);
	});

	it("names every reason", () => {
		const stale = {
			...side,
			lookingFor: 0,
			shareCrossPaths: false,
			locationUpdatedAt: new Date("2026-10-26T10:00:00Z"),
		};
		expect(crossingBlockers(side, stale, now)).toEqual([
			"different pools",
			"target has cross paths off",
			"target location older than 30 min",
		]);
	});
});

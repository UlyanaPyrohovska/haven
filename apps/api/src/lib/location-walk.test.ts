import { describe, expect, it } from "vitest";
import { moveMeters, nextWalkPosition, offsetMeters, randomPointInRadius } from "./location-walk";
import { haversineKm } from "./profile-view";

const kyiv = { latitude: 50.4501, longitude: 30.5234 };

function seeded(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
		return state / 2 ** 31;
	};
}

function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
	return (haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) ?? 0) * 1000;
}

describe("location walk", () => {
	it("round-trips meter offsets", () => {
		const offset = offsetMeters(kyiv, moveMeters(kyiv, 300, -200));
		expect(offset.east).toBeCloseTo(300, 6);
		expect(offset.north).toBeCloseTo(-200, 6);
	});

	it("starts inside the radius", () => {
		const rand = seeded(1);
		for (let i = 0; i < 200; i++) {
			expect(distanceM(kyiv, randomPointInRadius(kyiv, 800, rand))).toBeLessThanOrEqual(805);
		}
	});

	it("never leaves the radius and moves about one step each time", () => {
		const rand = seeded(7);
		let position = randomPointInRadius(kyiv, 800, rand);

		for (let i = 0; i < 2000; i++) {
			const next = nextWalkPosition(position, kyiv, 800, 150, rand);
			expect(distanceM(kyiv, next)).toBeLessThanOrEqual(805);
			expect(distanceM(position, next)).toBeLessThanOrEqual(155);
			position = next;
		}
	});

	it("walks back in when it starts outside", () => {
		const far = moveMeters(kyiv, 5000, 0);
		expect(distanceM(kyiv, nextWalkPosition(far, kyiv, 800, 150, seeded(3)))).toBeLessThanOrEqual(805);
	});
});

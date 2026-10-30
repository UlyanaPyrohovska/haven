import { describe, expect, it } from "vitest";
import { midpoint, placeLabel } from "./place-label";

describe("placeLabel", () => {
	it("uses the name of a public square or non-residential street", () => {
		expect(placeLabel({ osm_key: "place", osm_value: "square", name: "Praça do Bocage", city: "Setúbal" })).toBe(
			"Praça do Bocage",
		);
		expect(placeLabel({ osm_key: "highway", osm_value: "primary", name: "Avenida Luísa Todi" })).toBe(
			"Avenida Luísa Todi",
		);
	});

	it("names a landmark by the square it stands on", () => {
		expect(
			placeLabel({ osm_key: "tourism", osm_value: "artwork", name: "Estátua do Bocage", street: "Praça do Bocage" }),
		).toBe("Praça do Bocage");
	});

	it("falls back to the neighbourhood for residential streets, houses and businesses", () => {
		expect(placeLabel({ osm_key: "highway", osm_value: "residential", name: "Rua X", district: "Bonfim" })).toBe(
			"Bonfim",
		);
		expect(placeLabel({ osm_key: "building", osm_value: "house", name: "Casa", locality: "Troino" })).toBe("Troino");
		expect(placeLabel({ osm_key: "amenity", osm_value: "clinic", name: "Clínica", city: "Setúbal" })).toBe("Setúbal");
	});

	it("returns null when nothing usable comes back", () => {
		expect(placeLabel({ osm_key: "building" })).toBeNull();
	});
});

describe("midpoint", () => {
	it("averages the two points", () => {
		const point = midpoint({ latitude: 38, longitude: -9 }, { latitude: 38.01, longitude: -9.01 });

		expect(point.latitude).toBeCloseTo(38.005);
		expect(point.longitude).toBeCloseTo(-9.005);
	});
});

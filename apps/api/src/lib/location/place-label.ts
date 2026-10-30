/**
 * Street- or square-level name for where two people crossed paths, via Photon (Komoot, hosted in Germany,
 * so coordinates stay in the EU). Only a coordinate is sent, never a user id.
 */
const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
// Photon's public instance often takes 2–3 s; a shorter timeout always fell back to the city label.
const GEOCODE_TIMEOUT_MS = 5000;

/** OSM keys whose own name is a public place worth showing (a square, park, landmark, named road). */
const NAMED_PLACE_KEYS = new Set(["place", "highway", "leisure", "tourism", "historic"]);
/** Streets that likely run past someone's home: shown as the neighbourhood instead. */
const RESIDENTIAL_VALUES = new Set(["residential", "living_street", "service", "house"]);
/** Landmarks (a statue, a monument) read better as the square or street they stand on. */
const LANDMARK_KEYS = new Set(["tourism", "historic"]);

export type PhotonProperties = {
	osm_key?: string;
	osm_value?: string;
	name?: string;
	street?: string;
	district?: string;
	locality?: string;
	city?: string;
};

/**
 * Label for a Photon reverse result: a public named place (Praça do Bocage, a non-residential street),
 * otherwise the neighbourhood or city. Never a house number, a building or a business (could reveal a
 * home, workplace or clinic).
 */
export function placeLabel(properties: PhotonProperties): string | null {
	const { osm_key, osm_value, name } = properties;
	const isPublicPlace =
		osm_key !== undefined && NAMED_PLACE_KEYS.has(osm_key) && !RESIDENTIAL_VALUES.has(osm_value ?? "");

	if (isPublicPlace) {
		const label = (LANDMARK_KEYS.has(osm_key) && properties.street?.trim()) || name?.trim();

		if (label) {
			return label;
		}
	}

	// Locality is the short neighbourhood name; district can be a long parish name.
	return properties.locality?.trim() || properties.district?.trim() || properties.city?.trim() || null;
}

/** Midpoint of two nearby points; plain averaging is accurate enough within the 1 km crossing radius. */
export function midpoint(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number },
): { latitude: number; longitude: number } {
	return { latitude: (a.latitude + b.latitude) / 2, longitude: (a.longitude + b.longitude) / 2 };
}

/** Reverse-geocodes a point to a place label; null on any failure or timeout so callers can fall back. */
export async function reverseGeocodePlace(latitude: number, longitude: number): Promise<string | null> {
	try {
		const url = `${PHOTON_REVERSE_URL}?lat=${latitude}&lon=${longitude}&limit=1`;
		const response = await fetch(url, {
			headers: { "User-Agent": "Haven/1.0 (thesis project)" },
			signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
		});

		if (!response.ok) {
			return null;
		}

		const body = (await response.json()) as { features?: { properties?: PhotonProperties }[] };
		const properties = body.features?.[0]?.properties;

		return properties ? placeLabel(properties) : null;
	} catch {
		return null;
	}
}

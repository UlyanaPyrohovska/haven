/** Planar approximation around a point; fine for neighbourhood-sized distances. */
const METERS_PER_DEG_LAT = 111_320;

export type LatLon = { latitude: number; longitude: number };

function metersPerDegLon(latitude: number): number {
	return METERS_PER_DEG_LAT * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
}

/** East/north offset of `point` from `origin`, in meters. */
export function offsetMeters(origin: LatLon, point: LatLon): { east: number; north: number } {
	return {
		east: (point.longitude - origin.longitude) * metersPerDegLon(origin.latitude),
		north: (point.latitude - origin.latitude) * METERS_PER_DEG_LAT,
	};
}

export function moveMeters(origin: LatLon, east: number, north: number): LatLon {
	return {
		latitude: origin.latitude + north / METERS_PER_DEG_LAT,
		longitude: origin.longitude + east / metersPerDegLon(origin.latitude),
	};
}

/** Uniform random point inside the circle. */
export function randomPointInRadius(center: LatLon, radiusM: number, rand: () => number = Math.random): LatLon {
	const distance = radiusM * Math.sqrt(rand());
	const heading = rand() * 2 * Math.PI;

	return moveMeters(center, distance * Math.sin(heading), distance * Math.cos(heading));
}

/**
 * One step of a random walk that stays inside the circle: a random heading, but when the step would
 * leave the circle it heads back toward the center (with some jitter) instead.
 */
export function nextWalkPosition(
	current: LatLon,
	center: LatLon,
	radiusM: number,
	stepM: number,
	rand: () => number = Math.random,
): LatLon {
	let heading = rand() * 2 * Math.PI;
	let next = moveMeters(current, stepM * Math.sin(heading), stepM * Math.cos(heading));
	const { east, north } = offsetMeters(center, next);

	if (Math.hypot(east, north) > radiusM) {
		const back = offsetMeters(current, center);
		heading = Math.atan2(back.east, back.north) + (rand() - 0.5) * (Math.PI / 2);
		next = moveMeters(current, stepM * Math.sin(heading), stepM * Math.cos(heading));
	}

	const final = offsetMeters(center, next);
	const distance = Math.hypot(final.east, final.north);

	// Still outside (e.g. the center or radius just changed): clamp onto the circle.
	return distance > radiusM
		? moveMeters(center, (final.east / distance) * radiusM, (final.north / distance) * radiusM)
		: next;
}

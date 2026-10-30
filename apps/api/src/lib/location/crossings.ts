import { haversineKm } from "@/lib/profile/profile-view";

/** Two users count as crossing when both reported a location this close together… */
export const CROSSING_RADIUS_KM = 1;
/** …within this many minutes of each other. */
export const CROSSING_WINDOW_MINUTES = 30;
/** A pair counts at most once per cooldown, so staying near each other is one crossing, not many. */
export const CROSSING_COOLDOWN_HOURS = 6;

type Point = { latitude: number | null; longitude: number | null };

/** Undirected pair key: crossings rows are stored with `user_a < user_b`. */
export function crossingPair(a: number, b: number): { userA: number; userB: number } {
	return a < b ? { userA: a, userB: b } : { userA: b, userB: a };
}

/** Lat/lon box around a point that contains every point within `radiusKm`; prefilter for the DB index. */
export function boundingBox(latitude: number, longitude: number, radiusKm = CROSSING_RADIUS_KM) {
	const latDelta = radiusKm / 111;
	const lonDelta = radiusKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

	return {
		minLat: latitude - latDelta,
		maxLat: latitude + latDelta,
		minLon: longitude - lonDelta,
		maxLon: longitude + lonDelta,
	};
}

/** Ids of the others within the crossing radius of the viewer. */
export function crossedIds(viewer: Point, others: readonly (Point & { id: number })[]): number[] {
	return others
		.filter((other) => {
			const km = haversineKm(viewer.latitude, viewer.longitude, other.latitude, other.longitude);
			return km !== undefined && km <= CROSSING_RADIUS_KM;
		})
		.map((other) => other.id);
}

export type CrossingSide = {
	lookingFor: number;
	shareCrossPaths: boolean;
	locationHidden: boolean;
	latitude: number | null;
	longitude: number | null;
	locationUpdatedAt: Date | null;
};

/**
 * Why `mover` reporting its location now would not record a crossing with `other` (empty = it would, if
 * they are within the radius). Mirrors the filters in `recordCrossings`; used by the backoffice.
 */
export function crossingBlockers(mover: CrossingSide, other: CrossingSide, now = new Date()): string[] {
	const blockers: string[] = [];
	const windowStart = now.getTime() - CROSSING_WINDOW_MINUTES * 60_000;

	if (mover.lookingFor !== other.lookingFor) blockers.push("different pools");
	if (!mover.shareCrossPaths) blockers.push("walker has cross paths off");
	if (!other.shareCrossPaths) blockers.push("target has cross paths off");
	if (mover.locationHidden || mover.latitude == null || mover.longitude == null)
		blockers.push("walker has no location");
	if (other.locationHidden) blockers.push("target hides location");
	else if (other.latitude == null || other.longitude == null) blockers.push("target has no location");
	if (!other.locationUpdatedAt || other.locationUpdatedAt.getTime() < windowStart) {
		blockers.push(`target location older than ${CROSSING_WINDOW_MINUTES} min`);
	}

	return blockers;
}

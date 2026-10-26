import type { Db } from "@/db";
import type { ServiceError } from "@/lib/errors";
import { nextWalkPosition, randomPointInRadius } from "@/lib/location-walk";
import { recordCrossingsOnLocationUpdate } from "@/modules/recommendations/service";
import * as repository from "./repository";

/** Staff test tool: synthetic profiles walk around a target's area so crossings can be tested without a second phone. */

export const MAX_WALKERS_PER_ASSIGN = 20;

export type AssignWalkersInput = {
	/** Specific synthetic profiles; otherwise `count` are picked at random from the target's pool. */
	walkerIds?: number[];
	count?: number;
	centerLat?: number;
	centerLon?: number;
	radiusM: number;
	stepM: number;
	createdBy: string;
};

function badRequest(message: string): ServiceError {
	return { status: 400, code: "INVALID_WALK", message };
}

/** Moves the walker to `position`, stamps it fresh and records any crossing it causes. */
async function placeWalker(
	db: Db,
	walkerId: number,
	position: { latitude: number; longitude: number },
	now: Date,
	displayLocation?: string | null,
) {
	const profile = await repository.setProfileLocation(db, walkerId, {
		...position,
		...(displayLocation === undefined ? {} : { displayLocation }),
		locationUpdatedAt: now,
	});

	return profile ? recordCrossingsOnLocationUpdate(db, profile) : 0;
}

export async function assignWalkers(db: Db, targetId: number, input: AssignWalkersInput, now = new Date()) {
	const [target] = await repository.findWalkerProfiles(db, [targetId]);

	if (!target) {
		throw badRequest("Target profile not found");
	}

	const centerLat = input.centerLat ?? target.latitude;
	const centerLon = input.centerLon ?? target.longitude;

	if (centerLat == null || centerLon == null) {
		throw badRequest("The target has no location yet; pass a center");
	}

	const walkerIds = input.walkerIds?.length
		? [...new Set(input.walkerIds)].filter((id) => id !== targetId)
		: await repository.pickWalkerIds(db, target.lookingFor, input.count ?? 3, targetId);

	if (walkerIds.length === 0) {
		throw badRequest("No eligible synthetic profiles to walk");
	}

	if (walkerIds.length > MAX_WALKERS_PER_ASSIGN) {
		throw badRequest(`At most ${MAX_WALKERS_PER_ASSIGN} walkers at a time`);
	}

	const profiles = await repository.findWalkerProfiles(db, walkerIds);
	const nonSynthetic = walkerIds.filter((id) => !profiles.find((profile) => profile.id === id)?.isSynthetic);

	// Only synthetic profiles move; a real user's location is never overwritten.
	if (nonSynthetic.length > 0) {
		throw badRequest(`Not synthetic profiles: ${nonSynthetic.join(", ")}`);
	}

	const existing = (await repository.listWalkers(db)).map((row) => row.walk.walkerId);
	const taken = walkerIds.filter((id) => existing.includes(id));

	if (taken.length > 0) {
		throw badRequest(`Already walking: ${taken.join(", ")}`);
	}

	const center = { latitude: centerLat, longitude: centerLon };
	let crossingsRecorded = 0;

	for (const profile of profiles) {
		await repository.insertWalk(db, {
			walkerId: profile.id,
			targetId,
			centerLat,
			centerLon,
			radiusM: input.radiusM,
			stepM: input.stepM,
			lastStepAt: now,
			originalLat: profile.latitude,
			originalLon: profile.longitude,
			originalDisplayLocation: profile.displayLocation,
			createdBy: input.createdBy,
		});
		// The crossing's place label comes from the walker, so it borrows the target's area name.
		crossingsRecorded += await placeWalker(
			db,
			profile.id,
			randomPointInRadius(center, input.radiusM),
			now,
			target.displayLocation ?? profile.displayLocation,
		);
	}

	return { assigned: profiles.length, crossingsRecorded };
}

/** One step for every active walker (of one target, or all). Runs on the walker cron and from the backoffice. */
export async function stepWalkers(db: Db, opts: { targetId?: number; now?: Date } = {}) {
	const now = opts.now ?? new Date();
	const rows = await repository.listWalkers(db, { targetId: opts.targetId, activeOnly: true });
	let crossingsRecorded = 0;

	for (const { walk, profile } of rows) {
		const center = { latitude: walk.centerLat, longitude: walk.centerLon };
		const current =
			profile.latitude != null && profile.longitude != null
				? { latitude: profile.latitude, longitude: profile.longitude }
				: randomPointInRadius(center, walk.radiusM);

		crossingsRecorded += await placeWalker(
			db,
			walk.walkerId,
			nextWalkPosition(current, center, walk.radiusM, walk.stepM),
			now,
		);
		await repository.updateWalk(db, walk.walkerId, { lastStepAt: now });
	}

	return { stepped: rows.length, crossingsRecorded };
}

/** Ends the walk and puts the walker back at its seeded location. Crossings it made stay. */
export async function removeWalker(db: Db, walkerId: number) {
	const walk = await repository.findWalk(db, walkerId);

	if (!walk) {
		return false;
	}

	await repository.setProfileLocation(db, walkerId, {
		latitude: walk.originalLat,
		longitude: walk.originalLon,
		displayLocation: walk.originalDisplayLocation,
		locationUpdatedAt: null,
	});
	await repository.deleteWalk(db, walkerId);

	return true;
}

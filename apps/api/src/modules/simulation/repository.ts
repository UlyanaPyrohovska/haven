import { and, asc, desc, eq, exists, inArray, isNotNull, isNull, ne, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import { crossings, interactions, locationWalkers, recommendations, userProfiles } from "@/db/schema";
import { publicProfileColumns, type ViewerProfile } from "@/modules/recommendations/repository";

const target = alias(userProfiles, "target");

/**
 * Likes waiting on a synthetic agent's reply. Only likes that came from a recommendation, so the
 * historical dataset rows (one-sided, never recommended) are left alone.
 */
export function listPendingInboundForSynthetic(db: Db, limit: number) {
	return db
		.select({ likerId: interactions.userA, agentId: interactions.userB })
		.from(interactions)
		.innerJoin(target, eq(target.id, interactions.userB))
		.where(
			and(
				eq(target.isSynthetic, true),
				isNull(interactions.decB),
				eq(interactions.decA, 1),
				exists(
					sql`(
						SELECT 1 FROM ${recommendations}
						WHERE ${recommendations.userId} = ${interactions.userA}
						AND ${recommendations.candidateId} = ${interactions.userB}
						AND ${recommendations.actedOn} = true
					)`,
				),
			),
		)
		.orderBy(asc(interactions.createdAt))
		.limit(limit);
}

export async function sampleSyntheticAgentIds(db: Db, limit: number): Promise<number[]> {
	const rows = await db
		.select({ id: userProfiles.id })
		.from(userProfiles)
		.where(and(eq(userProfiles.isSynthetic, true), eq(userProfiles.discoverable, true)))
		.orderBy(sql`random()`)
		.limit(limit);

	return rows.map((row) => row.id);
}

export async function listRealProfiles(db: Db): Promise<ViewerProfile[]> {
	const rows = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(
			and(eq(userProfiles.isSynthetic, false), eq(userProfiles.discoverable, true), isNotNull(userProfiles.userId)),
		);

	return rows as ViewerProfile[];
}

export function listPendingRecommendationRows(db: Db, viewerId: number) {
	return db
		.select({ id: recommendations.id, candidateId: recommendations.candidateId })
		.from(recommendations)
		.where(and(eq(recommendations.userId, viewerId), eq(recommendations.actedOn, false)))
		.orderBy(asc(recommendations.rank));
}

const walkerProfileColumns = {
	id: userProfiles.id,
	displayName: userProfiles.displayName,
	gender: userProfiles.gender,
	isSynthetic: userProfiles.isSynthetic,
	lookingFor: userProfiles.lookingFor,
	discoverable: userProfiles.discoverable,
	shareCrossPaths: userProfiles.shareCrossPaths,
	locationHidden: userProfiles.locationHidden,
	latitude: userProfiles.latitude,
	longitude: userProfiles.longitude,
	displayLocation: userProfiles.displayLocation,
	locationUpdatedAt: userProfiles.locationUpdatedAt,
};

export type WalkerProfile = Awaited<ReturnType<typeof findWalkerProfiles>>[number];

export function findWalkerProfiles(db: Db, ids: number[]) {
	return db.select(walkerProfileColumns).from(userProfiles).where(inArray(userProfiles.id, ids));
}

export function listWalkers(db: Db, where?: { targetId?: number; activeOnly?: boolean }) {
	const conditions = [
		where?.targetId === undefined ? undefined : eq(locationWalkers.targetId, where.targetId),
		where?.activeOnly ? eq(locationWalkers.active, true) : undefined,
	].filter((condition) => condition !== undefined);

	return db
		.select({ walk: locationWalkers, profile: walkerProfileColumns })
		.from(locationWalkers)
		.innerJoin(userProfiles, eq(userProfiles.id, locationWalkers.walkerId))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(asc(locationWalkers.createdAt), asc(locationWalkers.walkerId));
}

export async function findWalk(db: Db, walkerId: number) {
	const [row] = await db.select().from(locationWalkers).where(eq(locationWalkers.walkerId, walkerId)).limit(1);

	return row ?? null;
}

/** Discoverable synthetic profiles in the pool that can cross (share cross paths, location visible) and aren't walking yet. */
export async function pickWalkerIds(db: Db, lookingFor: number, count: number, excludeId: number): Promise<number[]> {
	const rows = await db
		.select({ id: userProfiles.id })
		.from(userProfiles)
		.where(
			and(
				eq(userProfiles.isSynthetic, true),
				eq(userProfiles.discoverable, true),
				eq(userProfiles.lookingFor, lookingFor),
				eq(userProfiles.shareCrossPaths, true),
				eq(userProfiles.locationHidden, false),
				ne(userProfiles.id, excludeId),
				notExists(db.select().from(locationWalkers).where(eq(locationWalkers.walkerId, userProfiles.id))),
			),
		)
		.orderBy(sql`random()`)
		.limit(count);

	return rows.map((row) => row.id);
}

export async function insertWalk(db: Db, walk: typeof locationWalkers.$inferInsert) {
	await db.insert(locationWalkers).values(walk);
}

export async function updateWalk(db: Db, walkerId: number, updates: Partial<typeof locationWalkers.$inferInsert>) {
	await db.update(locationWalkers).set(updates).where(eq(locationWalkers.walkerId, walkerId));
}

export async function deleteWalk(db: Db, walkerId: number) {
	await db.delete(locationWalkers).where(eq(locationWalkers.walkerId, walkerId));
}

export async function setProfileLocation(
	db: Db,
	profileId: number,
	location: {
		latitude: number | null;
		longitude: number | null;
		displayLocation?: string | null;
		locationUpdatedAt: Date | null;
	},
): Promise<ViewerProfile | null> {
	const [row] = await db
		.update(userProfiles)
		.set({ ...location, updatedAt: new Date() })
		.where(eq(userProfiles.id, profileId))
		.returning(publicProfileColumns);

	return (row as ViewerProfile | undefined) ?? null;
}

/** Every crossing the profile is part of, with the other side's id. */
export async function listCrossingsOf(db: Db, profileId: number) {
	const rows = await db
		.select()
		.from(crossings)
		.where(or(eq(crossings.userA, profileId), eq(crossings.userB, profileId)))
		.orderBy(desc(crossings.lastCrossedAt));

	return rows.map(({ userA, userB, ...crossing }) => ({ otherId: userA === profileId ? userB : userA, ...crossing }));
}

import { and, asc, eq, getTableColumns, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { interactions, recommendations, userProfiles } from "@/db/schema";
import type { ProfileRow } from "@/lib/profile-view";

const { email: _email, passwordHash: _passwordHash, ...publicProfileColumns } = getTableColumns(userProfiles);

export { publicProfileColumns };

export type ViewerProfile = ProfileRow & { id: number };

export async function findViewerByUserId(db: Db, userId: string): Promise<ViewerProfile | null> {
	const [viewer] = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);

	return viewer ? (viewer as ViewerProfile) : null;
}

export function listPendingRecommendations(db: Db, viewerId: number) {
	return db
		.select({
			recommendation: recommendations,
			candidate: publicProfileColumns,
		})
		.from(recommendations)
		.innerJoin(userProfiles, eq(userProfiles.id, recommendations.candidateId))
		.where(and(eq(recommendations.userId, viewerId), eq(recommendations.actedOn, false)))
		.orderBy(asc(recommendations.rank));
}

export async function findRecommendationWithCandidate(db: Db, viewerId: number, candidateId: number) {
	const [row] = await db
		.select({
			recommendation: recommendations,
			candidate: publicProfileColumns,
		})
		.from(recommendations)
		.innerJoin(userProfiles, eq(userProfiles.id, recommendations.candidateId))
		.where(and(eq(recommendations.userId, viewerId), eq(recommendations.candidateId, candidateId)))
		.limit(1);

	return row ?? null;
}

export function listMatchInteractions(db: Db, viewerId: number) {
	return db
		.select()
		.from(interactions)
		.where(and(eq(interactions.match, true), or(eq(interactions.userA, viewerId), eq(interactions.userB, viewerId))));
}

export async function findCandidateProfile(db: Db, candidateId: number) {
	const [candidate] = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(eq(userProfiles.id, candidateId))
		.limit(1);

	return candidate ? (candidate as ViewerProfile) : null;
}

export async function findPendingRecommendationId(db: Db, viewerId: number, candidateId: number) {
	const [pending] = await db
		.select({ id: recommendations.id })
		.from(recommendations)
		.where(
			and(
				eq(recommendations.userId, viewerId),
				eq(recommendations.candidateId, candidateId),
				eq(recommendations.actedOn, false),
			),
		)
		.limit(1);

	return pending?.id ?? null;
}

export async function findInteractionBetween(db: Db, viewerId: number, candidateId: number) {
	const [existingInteraction] = await db
		.select()
		.from(interactions)
		.where(
			or(
				and(eq(interactions.userA, viewerId), eq(interactions.userB, candidateId)),
				and(eq(interactions.userA, candidateId), eq(interactions.userB, viewerId)),
			),
		)
		.limit(1);

	return existingInteraction ?? null;
}

export async function findCandidateCoordinates(db: Db, candidateId: number) {
	const [candidateProfile] = await db
		.select({
			latitude: userProfiles.latitude,
			longitude: userProfiles.longitude,
		})
		.from(userProfiles)
		.where(eq(userProfiles.id, candidateId))
		.limit(1);

	return candidateProfile ?? null;
}

export async function updateInteraction(
	db: Db,
	interactionId: number,
	updates: { decA?: number | null; decB?: number | null; match: boolean },
) {
	await db.update(interactions).set(updates).where(eq(interactions.id, interactionId));
}

export async function insertInteraction(
	db: Db,
	values: {
		userA: number;
		userB: number;
		decA: number;
		decB: number | null;
		match: boolean;
		distanceKm: number | null;
	},
) {
	await db.insert(interactions).values({
		...values,
		scoreAToB: null,
		scoreBToA: null,
	});
}

export async function markRecommendationActedOn(db: Db, recommendationId: number) {
	await db.update(recommendations).set({ actedOn: true }).where(eq(recommendations.id, recommendationId));
}

export async function countPendingRecommendations(db: Db, viewerId: number) {
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(recommendations)
		.where(and(eq(recommendations.userId, viewerId), eq(recommendations.actedOn, false)));

	return count ?? 0;
}

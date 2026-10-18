import { and, asc, eq, exists, getTableColumns, inArray, ne, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import { crossings, interactions, recommendations, userEmbeddings, userProfiles } from "@/db/schema";
import { customInterestKey } from "@/lib/custom-interests";
import { INTEREST_KEYS, type ProfileRow } from "@/lib/profile-view";
import { coerceLastShownAt } from "@/lib/recommendation-cadence";
import type { ScoringProfile } from "@/lib/scoring";

const { email: _email, passwordHash: _passwordHash, ...publicProfileColumns } = getTableColumns(userProfiles);

export { publicProfileColumns };

export type ViewerProfile = ProfileRow & { id: number };

export type ScoringViewerProfile = ScoringProfile & {
	lookingFor: number;
};

const PREF_KEYS = ["prefAttr", "prefSinc", "prefIntel", "prefFun", "prefAmb", "prefShar"] as const;
const SELF_KEYS = ["selfAttr", "selfSinc", "selfIntel", "selfFun", "selfAmb", "selfShar"] as const;

const scoringProfileSelect = {
	id: userProfiles.id,
	lookingFor: userProfiles.lookingFor,
	latitude: userProfiles.latitude,
	longitude: userProfiles.longitude,
	interestSports: userProfiles.interestSports,
	interestTvsports: userProfiles.interestTvsports,
	interestExercise: userProfiles.interestExercise,
	interestDining: userProfiles.interestDining,
	interestMuseums: userProfiles.interestMuseums,
	interestArt: userProfiles.interestArt,
	interestHiking: userProfiles.interestHiking,
	interestGaming: userProfiles.interestGaming,
	interestClubbing: userProfiles.interestClubbing,
	interestReading: userProfiles.interestReading,
	interestTv: userProfiles.interestTv,
	interestTheater: userProfiles.interestTheater,
	interestMovies: userProfiles.interestMovies,
	interestConcerts: userProfiles.interestConcerts,
	interestMusic: userProfiles.interestMusic,
	interestShopping: userProfiles.interestShopping,
	interestYoga: userProfiles.interestYoga,
	customInterests: userProfiles.customInterests,
	prefAttr: userProfiles.prefAttr,
	prefSinc: userProfiles.prefSinc,
	prefIntel: userProfiles.prefIntel,
	prefFun: userProfiles.prefFun,
	prefAmb: userProfiles.prefAmb,
	prefShar: userProfiles.prefShar,
	selfAttr: userProfiles.selfAttr,
	selfSinc: userProfiles.selfSinc,
	selfIntel: userProfiles.selfIntel,
	selfFun: userProfiles.selfFun,
	selfAmb: userProfiles.selfAmb,
	selfShar: userProfiles.selfShar,
	bio: userEmbeddings.bio,
} as const;

type ScoringProfileRow = {
	id: number;
	lookingFor: number;
	latitude: number | null;
	longitude: number | null;
	customInterests: string[];
	bio: unknown;
} & Record<(typeof INTEREST_KEYS)[number], number | null> &
	Record<(typeof PREF_KEYS)[number], number | null> &
	Record<(typeof SELF_KEYS)[number], number | null>;

export type RecommendationWriteRow = {
	candidateId: number;
	score: number;
	rank: number;
};

export type ListCandidatePoolOptions = {
	maxKm?: number | null;
	limit?: number;
	annShortlistLimit?: number;
	/** Simulation agents only recommend each other, so they never drain a real user's pool. */
	syntheticOnly?: boolean;
};

function parseBioEmbedding(value: unknown): number[] | null {
	if (value == null) {
		return null;
	}

	if (Array.isArray(value)) {
		return value.every((entry) => typeof entry === "number") ? value : null;
	}

	if (typeof value === "string") {
		try {
			const parsed: unknown = JSON.parse(value);

			return parseBioEmbedding(parsed);
		} catch {
			return null;
		}
	}

	return null;
}

function mapScoringProfileRow(row: ScoringProfileRow): ScoringViewerProfile {
	return {
		id: row.id,
		lookingFor: row.lookingFor,
		latitude: row.latitude,
		longitude: row.longitude,
		interests: INTEREST_KEYS.map((key) => row[key]),
		customInterests: row.customInterests.map(customInterestKey),
		pref: PREF_KEYS.map((key) => row[key]),
		self: SELF_KEYS.map((key) => row[key]),
		bioEmbedding: parseBioEmbedding(row.bio),
	};
}

function mapCandidateScoringProfile(row: ScoringProfileRow): ScoringProfile {
	const mapped = mapScoringProfileRow(row);

	return {
		id: mapped.id,
		interests: mapped.interests,
		customInterests: mapped.customInterests,
		pref: mapped.pref,
		self: mapped.self,
		latitude: mapped.latitude,
		longitude: mapped.longitude,
		bioEmbedding: mapped.bioEmbedding,
	};
}

function locationBoundingBox(latitude: number, longitude: number, maxKm: number) {
	const latDelta = maxKm / 111;
	const lonDelta = maxKm / (111 * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01));

	return sql`(
		${userProfiles.latitude} IS NULL
		OR ${userProfiles.longitude} IS NULL
		OR (
			${userProfiles.latitude} BETWEEN ${latitude - latDelta} AND ${latitude + latDelta}
			AND ${userProfiles.longitude} BETWEEN ${longitude - lonDelta} AND ${longitude + lonDelta}
		)
	)`;
}

function noInteractionWith(viewerId: number) {
	return not(
		exists(
			sql`(
				SELECT 1 FROM ${interactions}
				WHERE (
					${interactions.userA} = ${viewerId}
					AND ${interactions.userB} = ${userProfiles.id}
				) OR (
					${interactions.userA} = ${userProfiles.id}
					AND ${interactions.userB} = ${viewerId}
				)
			)`,
		),
	);
}

function poolConditions(viewer: ScoringViewerProfile, maxKm: number | null | undefined, syntheticOnly = false) {
	const conditions = [
		ne(userProfiles.id, viewer.id),
		eq(userProfiles.discoverable, true),
		eq(userProfiles.lookingFor, viewer.lookingFor),
		noInteractionWith(viewer.id),
	];

	if (syntheticOnly) {
		conditions.push(eq(userProfiles.isSynthetic, true));
	}

	if (maxKm != null && viewer.latitude != null && viewer.longitude != null) {
		conditions.push(locationBoundingBox(viewer.latitude, viewer.longitude, maxKm));
	}

	return and(...conditions);
}

export async function findScoringProfileById(db: Db, profileId: number): Promise<ScoringViewerProfile | null> {
	const [row] = await db
		.select(scoringProfileSelect)
		.from(userProfiles)
		.leftJoin(userEmbeddings, eq(userEmbeddings.userProfileId, userProfiles.id))
		.where(eq(userProfiles.id, profileId))
		.limit(1);

	return row ? mapScoringProfileRow(row as ScoringProfileRow) : null;
}

export async function listScoringProfilesByIds(db: Db, profileIds: number[]): Promise<ScoringViewerProfile[]> {
	if (profileIds.length === 0) {
		return [];
	}

	const rows = await db
		.select(scoringProfileSelect)
		.from(userProfiles)
		.leftJoin(userEmbeddings, eq(userEmbeddings.userProfileId, userProfiles.id))
		.where(inArray(userProfiles.id, profileIds));

	return rows.map((row) => mapScoringProfileRow(row as ScoringProfileRow));
}

export async function listCandidatePool(
	db: Db,
	viewer: ScoringViewerProfile,
	opts: ListCandidatePoolOptions = {},
): Promise<ScoringProfile[]> {
	const limit = opts.limit ?? 500;
	const annShortlistLimit = opts.annShortlistLimit ?? 200;
	const maxKm = opts.maxKm ?? null;
	const whereClause = poolConditions(viewer, maxKm, opts.syntheticOnly);
	const baseQuery = db
		.select(scoringProfileSelect)
		.from(userProfiles)
		.leftJoin(userEmbeddings, eq(userEmbeddings.userProfileId, userProfiles.id))
		.where(whereClause);

	const useAnn = viewer.bioEmbedding != null && viewer.bioEmbedding.length > 0;
	const rows = useAnn
		? await baseQuery
				.orderBy(sql`${userEmbeddings.bio} <=> ${JSON.stringify(viewer.bioEmbedding)}::vector`)
				.limit(Math.min(limit, annShortlistLimit))
		: await baseQuery.limit(limit);

	return rows.map((row) => mapCandidateScoringProfile(row as ScoringProfileRow));
}

export async function replaceRecommendations(db: Db, viewerId: number, rows: RecommendationWriteRow[]) {
	const deletePending = db
		.delete(recommendations)
		.where(and(eq(recommendations.userId, viewerId), eq(recommendations.actedOn, false)));

	if (rows.length === 0) {
		await deletePending;
		return;
	}

	const insertRows = rows.map((row) => ({
		userId: viewerId,
		candidateId: row.candidateId,
		score: row.score,
		rank: row.rank,
		actedOn: false,
	}));

	const upsertPending = db
		.insert(recommendations)
		.values(insertRows)
		.onConflictDoUpdate({
			target: [recommendations.userId, recommendations.candidateId],
			set: {
				score: sql`excluded.score`,
				rank: sql`excluded.rank`,
			},
		});

	await db.batch([deletePending, upsertPending]);
}

export type Crossing = { count: number; lastPlace: string | null; lastCrossedAt: Date | null };

/**
 * Crossings between the viewer and each candidate (keyed by candidate id). Pairs where either
 * side turned off `shareCrossPaths` are excluded, so callers can treat absence as count 0.
 */
export async function listCrossings(db: Db, viewerId: number, candidateIds: number[]): Promise<Map<number, Crossing>> {
	const counts = new Map<number, Crossing>();

	if (candidateIds.length === 0) {
		return counts;
	}

	const profileA = alias(userProfiles, "crossing_a");
	const profileB = alias(userProfiles, "crossing_b");
	const rows = await db
		.select({
			userA: crossings.userA,
			userB: crossings.userB,
			count: crossings.count,
			lastPlace: crossings.lastPlace,
			lastCrossedAt: crossings.lastCrossedAt,
		})
		.from(crossings)
		.innerJoin(profileA, eq(profileA.id, crossings.userA))
		.innerJoin(profileB, eq(profileB.id, crossings.userB))
		.where(
			and(
				or(
					and(eq(crossings.userA, viewerId), inArray(crossings.userB, candidateIds)),
					and(eq(crossings.userB, viewerId), inArray(crossings.userA, candidateIds)),
				),
				eq(profileA.shareCrossPaths, true),
				eq(profileB.shareCrossPaths, true),
			),
		);

	for (const row of rows) {
		const { userA, userB, ...crossing } = row;
		counts.set(userA === viewerId ? userB : userA, crossing);
	}

	return counts;
}

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
		.where(
			and(
				eq(recommendations.userId, viewerId),
				eq(recommendations.actedOn, false),
				eq(userProfiles.discoverable, true),
			),
		)
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

export async function getLastBatchShownAt(db: Db, viewerId: number): Promise<Date | null> {
	const [row] = await db
		.select({ lastShown: sql<Date | null>`max(${recommendations.shownAt})` })
		.from(recommendations)
		.where(eq(recommendations.userId, viewerId));

	return coerceLastShownAt(row?.lastShown ?? null);
}

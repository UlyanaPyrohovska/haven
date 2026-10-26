import {
	and,
	asc,
	eq,
	exists,
	getTableColumns,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	ne,
	not,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import {
	crossings,
	dailyQuestionAnswers,
	interactions,
	matchingConfig,
	moodCheckins,
	recommendations,
	userEmbeddings,
	userProfiles,
} from "@/db/schema";
import { ageFromBirthDate, parseIsoDate } from "@/lib/age";
import { syntheticDailyAnswer } from "@/lib/candidate-daily-answer";
import { syntheticMoodForProfile } from "@/lib/candidate-mood";
import {
	boundingBox,
	CROSSING_COOLDOWN_HOURS,
	CROSSING_WINDOW_MINUTES,
	crossedIds,
	crossingPair,
} from "@/lib/crossings";
import { customInterestKey } from "@/lib/custom-interests";
import { type MatchingConfig, resolveMatchingConfig, toMatchingConfigRow } from "@/lib/matching-config";
import { moodSlug, utcToday } from "@/lib/mood";
import { birthDateWindow, mutualFilterMatch, type PartnerFilterProfile } from "@/lib/partner-filters";
import { INTEREST_KEYS, type ProfileRow } from "@/lib/profile-view";
import { coerceLastShownAt } from "@/lib/recommendation-cadence";
import type { ScoringProfile } from "@/lib/scoring";

const { email: _email, passwordHash: _passwordHash, ...publicProfileColumns } = getTableColumns(userProfiles);

export { publicProfileColumns };

export type ViewerProfile = ProfileRow & { id: number };

export type ScoringViewerProfile = ScoringProfile &
	PartnerFilterProfile & {
		lookingFor: number;
	};

const PREF_KEYS = ["prefAttr", "prefSinc", "prefIntel", "prefFun", "prefAmb", "prefShar"] as const;
const SELF_KEYS = ["selfAttr", "selfSinc", "selfIntel", "selfFun", "selfAmb", "selfShar"] as const;

/** Scoring columns plus the profile's mood and daily answer for `date` (UTC). */
const scoringProfileSelect = (date: string) => ({
	id: userProfiles.id,
	isSynthetic: userProfiles.isSynthetic,
	moodToday: sql<number | null>`(
		SELECT ${moodCheckins.mood} FROM ${moodCheckins}
		WHERE ${moodCheckins.userProfileId} = ${userProfiles.id} AND ${moodCheckins.checkinDate} = ${date}
	)`,
	dailyAnswerToday: sql<string | null>`(
		SELECT ${dailyQuestionAnswers.answer} FROM ${dailyQuestionAnswers}
		WHERE ${dailyQuestionAnswers.userProfileId} = ${userProfiles.id} AND ${dailyQuestionAnswers.answerDate} = ${date}
	)`,
	lookingFor: userProfiles.lookingFor,
	gender: userProfiles.gender,
	birthDate: userProfiles.birthDate,
	interestedIn: userProfiles.interestedIn,
	prefAgeMin: userProfiles.prefAgeMin,
	prefAgeMax: userProfiles.prefAgeMax,
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
});

type ScoringProfileRow = {
	id: number;
	isSynthetic: boolean;
	moodToday: number | null;
	dailyAnswerToday: string | null;
	lookingFor: number;
	gender: number | null;
	birthDate: string | null;
	interestedIn: number[] | null;
	prefAgeMin: number | null;
	prefAgeMax: number | null;
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

/** Synthetic profiles get their deterministic mood and answer for `date`, like the detail screen shows. */
function mapScoringProfileRow(row: ScoringProfileRow, date: string): ScoringViewerProfile {
	return {
		id: row.id,
		lookingFor: row.lookingFor,
		gender: row.gender,
		birthDate: row.birthDate ? parseIsoDate(row.birthDate) : null,
		interestedIn: row.interestedIn,
		prefAgeMin: row.prefAgeMin,
		prefAgeMax: row.prefAgeMax,
		latitude: row.latitude,
		longitude: row.longitude,
		interests: INTEREST_KEYS.map((key) => row[key]),
		customInterests: row.customInterests.map(customInterestKey),
		pref: PREF_KEYS.map((key) => row[key]),
		self: SELF_KEYS.map((key) => row[key]),
		bioEmbedding: parseBioEmbedding(row.bio),
		mood: row.isSynthetic
			? syntheticMoodForProfile(row.id, date)
			: row.moodToday == null
				? null
				: moodSlug(row.moodToday),
		dailyAnswer: row.isSynthetic ? syntheticDailyAnswer(row.id, date) : row.dailyAnswerToday?.trim() || null,
	};
}

function mapCandidateScoringProfile(row: ScoringProfileRow, date: string): ScoringProfile {
	const mapped = mapScoringProfileRow(row, date);

	return {
		id: mapped.id,
		interests: mapped.interests,
		customInterests: mapped.customInterests,
		pref: mapped.pref,
		self: mapped.self,
		latitude: mapped.latitude,
		longitude: mapped.longitude,
		bioEmbedding: mapped.bioEmbedding,
		mood: mapped.mood,
		dailyAnswer: mapped.dailyAnswer,
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

/**
 * Drops candidates the viewer already decided on, or who passed on (or blocked) the viewer.
 * A candidate's pending like stays in the pool so the viewer can answer it.
 */
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
					AND (${interactions.decB} IS NOT NULL OR ${interactions.decA} IS DISTINCT FROM 1)
				)
			)`,
		),
	);
}

/** Candidate liked the viewer and the viewer has not answered yet. */
function likesViewer(viewerId: number) {
	return sql`EXISTS (
		SELECT 1 FROM ${interactions}
		WHERE ${interactions.userA} = ${userProfiles.id}
			AND ${interactions.userB} = ${viewerId}
			AND ${interactions.decA} = 1
			AND ${interactions.decB} IS NULL
	)`;
}

/**
 * Mutual gender and age filters (mirrors `mutualFilterMatch`). Null filters and unknown
 * candidate data pass, so nobody disappears just because a field is empty.
 */
function partnerFilterConditions(viewer: ScoringViewerProfile): SQL[] {
	const conditions: SQL[] = [];

	// Viewer -> candidate
	if (viewer.interestedIn && viewer.interestedIn.length > 0) {
		conditions.push(or(isNull(userProfiles.gender), inArray(userProfiles.gender, viewer.interestedIn)) as SQL);
	}

	const { latest, earliestExclusive } = birthDateWindow(viewer.prefAgeMin, viewer.prefAgeMax);

	if (latest) {
		conditions.push(or(isNull(userProfiles.birthDate), lte(userProfiles.birthDate, latest)) as SQL);
	}

	if (earliestExclusive) {
		conditions.push(or(isNull(userProfiles.birthDate), gt(userProfiles.birthDate, earliestExclusive)) as SQL);
	}

	// Candidate -> viewer
	if (viewer.gender != null) {
		conditions.push(
			sql`(${userProfiles.interestedIn} IS NULL OR cardinality(${userProfiles.interestedIn}) = 0 OR ${viewer.gender} = ANY(${userProfiles.interestedIn}))`,
		);
	}

	if (viewer.birthDate) {
		const viewerAge = ageFromBirthDate(viewer.birthDate);
		conditions.push(or(isNull(userProfiles.prefAgeMin), lte(userProfiles.prefAgeMin, viewerAge)) as SQL);
		conditions.push(or(isNull(userProfiles.prefAgeMax), gte(userProfiles.prefAgeMax, viewerAge)) as SQL);
	}

	return conditions;
}

function poolConditions(viewer: ScoringViewerProfile, maxKm: number | null | undefined, syntheticOnly = false) {
	const conditions = [
		ne(userProfiles.id, viewer.id),
		eq(userProfiles.discoverable, true),
		eq(userProfiles.lookingFor, viewer.lookingFor),
		noInteractionWith(viewer.id),
		...partnerFilterConditions(viewer),
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
	const date = utcToday();
	const [row] = await db
		.select(scoringProfileSelect(date))
		.from(userProfiles)
		.leftJoin(userEmbeddings, eq(userEmbeddings.userProfileId, userProfiles.id))
		.where(eq(userProfiles.id, profileId))
		.limit(1);

	return row ? mapScoringProfileRow(row as ScoringProfileRow, date) : null;
}

export async function listScoringProfilesByIds(db: Db, profileIds: number[]): Promise<ScoringViewerProfile[]> {
	if (profileIds.length === 0) {
		return [];
	}

	const date = utcToday();
	const rows = await db
		.select(scoringProfileSelect(date))
		.from(userProfiles)
		.leftJoin(userEmbeddings, eq(userEmbeddings.userProfileId, userProfiles.id))
		.where(inArray(userProfiles.id, profileIds));

	return rows.map((row) => mapScoringProfileRow(row as ScoringProfileRow, date));
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
	const date = utcToday();
	const baseQuery = db
		.select(scoringProfileSelect(date))
		.from(userProfiles)
		.leftJoin(userEmbeddings, eq(userEmbeddings.userProfileId, userProfiles.id))
		.where(whereClause);

	const useAnn = viewer.bioEmbedding != null && viewer.bioEmbedding.length > 0;
	// Pending likes first, so the cap or the ANN shortlist never hides them.
	const likedFirst = sql`${likesViewer(viewer.id)} DESC`;
	const rows = useAnn
		? await baseQuery
				.orderBy(likedFirst, sql`${userEmbeddings.bio} <=> ${JSON.stringify(viewer.bioEmbedding)}::vector`)
				.limit(Math.min(limit, annShortlistLimit))
		: await baseQuery.orderBy(likedFirst).limit(limit);

	return rows.map((row) => mapCandidateScoringProfile(row as ScoringProfileRow, date));
}

/** `shownAt` set keeps the batch's original time, so a regenerated batch doesn't move the cooldown. */
export async function replaceRecommendations(db: Db, viewerId: number, rows: RecommendationWriteRow[], shownAt?: Date) {
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
		...(shownAt ? { shownAt } : {}),
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

type CrossingViewer = {
	id: number;
	lookingFor: number;
	latitude: number;
	longitude: number;
	/** Area label of the viewer (city level), stored as the crossing's place. */
	displayLocation: string | null;
};

/**
 * Records a crossing with every same-pool user who reported a location within the crossing radius in the
 * last `CROSSING_WINDOW_MINUTES`. Both sides must share cross paths and not hide their location. A pair
 * counts again only after `CROSSING_COOLDOWN_HOURS`. Only the count, time and area label are stored.
 */
export async function recordCrossings(db: Db, viewer: CrossingViewer, now = new Date()): Promise<number> {
	const box = boundingBox(viewer.latitude, viewer.longitude);
	const nearby = await db
		.select({ id: userProfiles.id, latitude: userProfiles.latitude, longitude: userProfiles.longitude })
		.from(userProfiles)
		.where(
			and(
				ne(userProfiles.id, viewer.id),
				eq(userProfiles.lookingFor, viewer.lookingFor),
				eq(userProfiles.shareCrossPaths, true),
				eq(userProfiles.locationHidden, false),
				gte(userProfiles.locationUpdatedAt, new Date(now.getTime() - CROSSING_WINDOW_MINUTES * 60_000)),
				gte(userProfiles.latitude, box.minLat),
				lte(userProfiles.latitude, box.maxLat),
				gte(userProfiles.longitude, box.minLon),
				lte(userProfiles.longitude, box.maxLon),
			),
		);
	const ids = crossedIds(viewer, nearby);

	if (ids.length === 0) {
		return 0;
	}

	const cooldownStart = new Date(now.getTime() - CROSSING_COOLDOWN_HOURS * 3_600_000);
	const place = viewer.displayLocation?.trim() || null;

	await db
		.insert(crossings)
		.values(ids.map((id) => ({ ...crossingPair(viewer.id, id), count: 1, lastCrossedAt: now, lastPlace: place })))
		.onConflictDoUpdate({
			target: [crossings.userA, crossings.userB],
			set: {
				count: sql`least(${crossings.count} + 1, 32767)`,
				lastCrossedAt: now,
				lastPlace: place,
			},
			setWhere: or(isNull(crossings.lastCrossedAt), lt(crossings.lastCrossedAt, cooldownStart)),
		});

	return ids.length;
}

/** Profile ids whose like on the viewer is still unanswered. */
export async function listPendingLikerIds(db: Db, viewerId: number): Promise<Set<number>> {
	const rows = await db
		.select({ id: interactions.userA })
		.from(interactions)
		.where(and(eq(interactions.userB, viewerId), eq(interactions.decA, 1), isNull(interactions.decB)));

	return new Set(rows.map((row) => row.id));
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

/**
 * Whether the viewer accepted or declined anyone in the current batch (rows sharing the latest `shown_at`,
 * compared at ms precision because a regenerated batch reuses it through a JS Date). Rows retired by
 * `dismissPendingFilterMisfits` are acted-on too but have no viewer decision, so they don't count.
 */
export async function hasDecidedInCurrentBatch(db: Db, viewerId: number): Promise<boolean> {
	const batchStart = sql`date_trunc('milliseconds', (select max(${recommendations.shownAt}) from ${recommendations} where ${recommendations.userId} = ${viewerId}))`;
	const [row] = await db
		.select({ id: recommendations.id })
		.from(recommendations)
		.innerJoin(
			interactions,
			or(
				and(
					eq(interactions.userA, viewerId),
					eq(interactions.userB, recommendations.candidateId),
					isNotNull(interactions.decA),
				),
				and(
					eq(interactions.userB, viewerId),
					eq(interactions.userA, recommendations.candidateId),
					isNotNull(interactions.decB),
				),
			),
		)
		.where(
			and(
				eq(recommendations.userId, viewerId),
				eq(recommendations.actedOn, true),
				gte(recommendations.shownAt, batchStart),
			),
		)
		.limit(1);

	return Boolean(row);
}

const filterProfileSelect = {
	id: userProfiles.id,
	gender: userProfiles.gender,
	birthDate: userProfiles.birthDate,
	interestedIn: userProfiles.interestedIn,
	prefAgeMin: userProfiles.prefAgeMin,
	prefAgeMax: userProfiles.prefAgeMax,
} as const;

type FilterProfileRow = {
	gender: number | null;
	birthDate: string | null;
	interestedIn: number[] | null;
	prefAgeMin: number | null;
	prefAgeMax: number | null;
};

function toFilterProfile(row: FilterProfileRow): PartnerFilterProfile {
	return { ...row, birthDate: row.birthDate ? parseIsoDate(row.birthDate) : null };
}

/**
 * After a filter change, retires pending recommendations (in both directions) that no longer
 * pass the mutual filters. Rows are marked acted-on instead of deleted so `shown_at` still
 * drives the cooldown: the batch shrinks but is never refilled early.
 */
export async function dismissPendingFilterMisfits(db: Db, profileId: number): Promise<number> {
	const [self] = await db.select(filterProfileSelect).from(userProfiles).where(eq(userProfiles.id, profileId));

	if (!self) {
		return 0;
	}

	const other = alias(userProfiles, "other");
	const pending = await db
		.select({
			id: recommendations.id,
			gender: other.gender,
			birthDate: other.birthDate,
			interestedIn: other.interestedIn,
			prefAgeMin: other.prefAgeMin,
			prefAgeMax: other.prefAgeMax,
		})
		.from(recommendations)
		.innerJoin(
			other,
			or(
				and(eq(recommendations.userId, profileId), eq(other.id, recommendations.candidateId)),
				and(eq(recommendations.candidateId, profileId), eq(other.id, recommendations.userId)),
			),
		)
		.where(eq(recommendations.actedOn, false));

	const viewer = toFilterProfile(self);
	const misfitIds = pending.filter((row) => !mutualFilterMatch(viewer, toFilterProfile(row))).map((row) => row.id);

	if (misfitIds.length > 0) {
		await db.update(recommendations).set({ actedOn: true }).where(inArray(recommendations.id, misfitIds));
	}

	return misfitIds.length;
}

export async function findMatchingConfigRow(db: Db) {
	const [row] = await db.select().from(matchingConfig).where(eq(matchingConfig.id, 1)).limit(1);

	return row ?? null;
}

/** Staff-saved matching rules, else code defaults (`envCooldown` is `REC_COOLDOWN_HOURS`). */
export async function loadMatchingConfig(db: Db, envCooldown?: string): Promise<MatchingConfig> {
	return resolveMatchingConfig(await findMatchingConfigRow(db), envCooldown);
}

export async function saveMatchingConfig(db: Db, config: MatchingConfig, updatedBy: string) {
	const values = { ...toMatchingConfigRow(config), updatedBy, updatedAt: new Date() };

	await db
		.insert(matchingConfig)
		.values({ id: 1, ...values })
		.onConflictDoUpdate({ target: matchingConfig.id, set: values });
}

import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
	dailyQuestionAnswers,
	interactions,
	messages,
	moodCheckins,
	recommendations,
	reports,
	user,
	userProfiles,
} from "@/db/schema";
import type { ProfileUpdate } from "@/modules/profile/schemas";
import type { InteractionGraphQuery, StaffUserListQuery } from "./schemas";

const profileColumns = getTableColumns(userProfiles);

export async function countProfiles(db: Db, query: StaffUserListQuery) {
	const where = buildSearchWhere(query.q);

	const base = db.select({ total: count() }).from(userProfiles);
	const [row] = where ? await base.where(where) : await base;

	return row?.total ?? 0;
}

export async function listProfiles(db: Db, query: StaffUserListQuery) {
	const where = buildSearchWhere(query.q);

	const base = db
		.select({
			profileId: userProfiles.id,
			userId: userProfiles.userId,
			displayName: userProfiles.displayName,
			email: userProfiles.email,
			isSynthetic: userProfiles.isSynthetic,
			lookingFor: userProfiles.lookingFor,
			createdAt: userProfiles.createdAt,
		})
		.from(userProfiles)
		.orderBy(desc(userProfiles.id))
		.limit(query.limit)
		.offset(query.offset);

	return where ? base.where(where) : base;
}

export async function findProfileById(db: Db, profileId: number) {
	const [row] = await db.select(profileColumns).from(userProfiles).where(eq(userProfiles.id, profileId)).limit(1);

	return row ?? null;
}

export async function findAuthUserById(db: Db, authUserId: string) {
	const [row] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			role: user.role,
			banned: user.banned,
			banReason: user.banReason,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})
		.from(user)
		.where(eq(user.id, authUserId))
		.limit(1);

	return row ?? null;
}

export async function updateProfileById(db: Db, profileId: number, updates: ProfileUpdate) {
	const [row] = await db
		.update(userProfiles)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(userProfiles.id, profileId))
		.returning(profileColumns);

	return row ?? null;
}

export async function updateAuthUserById(db: Db, authUserId: string, updates: { name?: string; email?: string }) {
	const [row] = await db
		.update(user)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(user.id, authUserId))
		.returning({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			role: user.role,
			banned: user.banned,
			banReason: user.banReason,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		});

	return row ?? null;
}

export async function deleteProfileById(db: Db, profileId: number) {
	const [row] = await db.delete(userProfiles).where(eq(userProfiles.id, profileId)).returning({ id: userProfiles.id });

	return row ?? null;
}

export async function deleteAuthUserById(db: Db, authUserId: string) {
	const [row] = await db.delete(user).where(eq(user.id, authUserId)).returning({ id: user.id });

	return row ?? null;
}

function buildSearchWhere(q?: string) {
	if (!q?.trim()) {
		return undefined;
	}

	const term = `%${q.trim()}%`;
	const profileId = Number.parseInt(q, 10);

	const clauses = [
		ilike(userProfiles.displayName, term),
		ilike(userProfiles.email, term),
		ilike(userProfiles.userId, term),
	];

	if (!Number.isNaN(profileId)) {
		clauses.push(eq(userProfiles.id, profileId));
	}

	return or(...clauses);
}

export function listGraphEdges(db: Db, query: InteractionGraphQuery) {
	const conditions = [eq(userProfiles.lookingFor, query.lookingFor)];

	if (query.edges === "match") {
		conditions.push(eq(interactions.match, true));
	} else if (query.edges === "like") {
		const like = or(eq(interactions.decA, 1), eq(interactions.decB, 1));
		if (like) conditions.push(like);
	}

	if (query.since) {
		conditions.push(gte(interactions.createdAt, new Date(query.since)));
	}

	// Pools never cross, so filtering on user A's pool is enough.
	return db
		.select({
			source: interactions.userA,
			target: interactions.userB,
			decA: interactions.decA,
			decB: interactions.decB,
			match: interactions.match,
		})
		.from(interactions)
		.innerJoin(userProfiles, eq(userProfiles.id, interactions.userA))
		.where(and(...conditions))
		.orderBy(desc(interactions.createdAt))
		.limit(query.limit);
}

export function listGraphNodes(db: Db, profileIds: number[]) {
	if (profileIds.length === 0) {
		return Promise.resolve([]);
	}

	return db
		.select({
			id: userProfiles.id,
			displayName: userProfiles.displayName,
			gender: userProfiles.gender,
			isSynthetic: userProfiles.isSynthetic,
			lookingFor: userProfiles.lookingFor,
		})
		.from(userProfiles)
		.where(inArray(userProfiles.id, profileIds));
}

export async function profileTotals(db: Db) {
	const [row] = await db
		.select({
			total: count(),
			synthetic: sql<number>`count(*) filter (where ${userProfiles.isSynthetic})`.mapWith(Number),
			dating: sql<number>`count(*) filter (where ${userProfiles.lookingFor} = 1)`.mapWith(Number),
		})
		.from(userProfiles);

	return row;
}

export async function activityTotals(db: Db, today: string) {
	const [[matches], [messageCount], [reportCount], [answersToday], [moodsToday]] = await Promise.all([
		db.select({ value: count() }).from(interactions).where(eq(interactions.match, true)),
		db.select({ value: count() }).from(messages),
		db.select({ value: count() }).from(reports),
		db.select({ value: count() }).from(dailyQuestionAnswers).where(eq(dailyQuestionAnswers.answerDate, today)),
		db.select({ value: count() }).from(moodCheckins).where(eq(moodCheckins.checkinDate, today)),
	]);

	return {
		matches: matches?.value ?? 0,
		messages: messageCount?.value ?? 0,
		reports: reportCount?.value ?? 0,
		dailyAnswersToday: answersToday?.value ?? 0,
		moodCheckinsToday: moodsToday?.value ?? 0,
	};
}

/** Real (non-synthetic) sign-ups per UTC day since `since`. */
export function realSignupsByDay(db: Db, since: Date) {
	const day = sql<string>`to_char(${userProfiles.createdAt}, 'YYYY-MM-DD')`;

	return db
		.select({ day, count: count() })
		.from(userProfiles)
		.where(and(eq(userProfiles.isSynthetic, false), gte(userProfiles.createdAt, since)))
		.groupBy(day);
}

export function matchesByDay(db: Db, since: Date) {
	const day = sql<string>`to_char(${interactions.createdAt}, 'YYYY-MM-DD')`;

	return db
		.select({ day, count: count() })
		.from(interactions)
		.where(and(eq(interactions.match, true), gte(interactions.createdAt, since)))
		.groupBy(day);
}

export function moodCounts(db: Db, sinceDate: string) {
	return db
		.select({ mood: moodCheckins.mood, count: count() })
		.from(moodCheckins)
		.where(gte(moodCheckins.checkinDate, sinceDate))
		.groupBy(moodCheckins.mood);
}

/** Every recommendation shown to the profile, pending or acted on, newest batch first. */
export function listRecommendationsForUser(db: Db, profileId: number) {
	return db
		.select({
			candidateId: recommendations.candidateId,
			score: recommendations.score,
			rank: recommendations.rank,
			shownAt: recommendations.shownAt,
			actedOn: recommendations.actedOn,
			displayName: userProfiles.displayName,
			gender: userProfiles.gender,
			isSynthetic: userProfiles.isSynthetic,
		})
		.from(recommendations)
		.innerJoin(userProfiles, eq(userProfiles.id, recommendations.candidateId))
		.where(eq(recommendations.userId, profileId))
		.orderBy(desc(recommendations.shownAt), recommendations.rank);
}

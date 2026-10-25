import type { Context } from "hono";
import { getDb } from "@/db";
import { displayNameForCandidate } from "@/lib/candidate-display";
import { fillDailySeries, lastUtcDays } from "@/lib/daily-series";
import { errors } from "@/lib/errors";
import { MoodSlugs, moodSlug, utcToday } from "@/lib/mood";
import { CADENCE, resolveRecCooldownHours } from "@/lib/recommendation-cadence";
import { applyCrossPathsBoost, DEFAULT_WEIGHTS, reciprocalScore, scoreBreakdown } from "@/lib/scoring";
import { requireStaffAdmin } from "@/lib/session";
import { notify } from "@/modules/notifications/service";
import type { ProfileUpdate } from "@/modules/profile/schemas";
import { generateRecommendations } from "@/modules/recommendations/generator";
import * as recommendationsRepository from "@/modules/recommendations/repository";
import { runTick } from "@/modules/simulation/engine";
import * as repository from "./repository";
import type { InteractionGraphQuery, StaffUserListQuery, StaffUserUpdate } from "./schemas";

function serializeAuthUser(row: NonNullable<Awaited<ReturnType<typeof repository.findAuthUserById>>>) {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		emailVerified: row.emailVerified,
		role: row.role ?? null,
		banned: row.banned ?? null,
		banReason: row.banReason ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function serializeProfile(row: NonNullable<Awaited<ReturnType<typeof repository.findProfileById>>>) {
	return {
		...row,
		birthDate: row.birthDate ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function listUsers(c: Context<{ Bindings: CloudflareBindings }>, query: StaffUserListQuery) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const [users, total] = await Promise.all([repository.listProfiles(db, query), repository.countProfiles(db, query)]);

	return {
		users: users.map((row) => ({
			profileId: row.profileId,
			userId: row.userId,
			displayName: row.displayName,
			email: row.email,
			isSynthetic: row.isSynthetic,
			lookingFor: row.lookingFor,
			createdAt: row.createdAt.toISOString(),
		})),
		total,
		limit: query.limit,
		offset: query.offset,
	};
}

export async function getUser(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const profile = await repository.findProfileById(db, profileId);
	if (!profile) {
		throw errors.not_found;
	}

	const auth = profile.userId ? await repository.findAuthUserById(db, profile.userId) : null;

	return {
		profile: serializeProfile(profile),
		auth: auth ? serializeAuthUser(auth) : null,
	};
}

export async function updateUser(
	c: Context<{ Bindings: CloudflareBindings }>,
	profileId: number,
	body: StaffUserUpdate,
) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const existing = await repository.findProfileById(db, profileId);
	if (!existing) {
		throw errors.not_found;
	}

	const { authName, authEmail, ...profileUpdates } = body;

	let profile = existing;
	if (Object.keys(profileUpdates).length > 0) {
		const updated = await repository.updateProfileById(db, profileId, profileUpdates as ProfileUpdate);
		if (!updated) {
			throw errors.not_found;
		}
		profile = updated;
	}

	let auth = existing.userId ? await repository.findAuthUserById(db, existing.userId) : null;
	if (existing.userId && (authName !== undefined || authEmail !== undefined)) {
		const authUpdates: { name?: string; email?: string } = {};
		if (authName !== undefined) {
			authUpdates.name = authName;
		}
		if (authEmail !== undefined) {
			authUpdates.email = authEmail;
		}

		const updatedAuth = await repository.updateAuthUserById(db, existing.userId, authUpdates);
		if (updatedAuth) {
			auth = updatedAuth;
		}
	}

	return {
		profile: serializeProfile(profile),
		auth: auth ? serializeAuthUser(auth) : null,
	};
}

export async function deleteUser(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const existing = await repository.findProfileById(db, profileId);
	if (!existing) {
		throw errors.not_found;
	}

	const authUserId = existing.userId;

	await repository.deleteProfileById(db, profileId);

	if (authUserId) {
		await repository.deleteAuthUserById(db, authUserId);
	}

	return { deleted: true, profileId };
}

export async function simulationTick(c: Context<{ Bindings: CloudflareBindings }>, limit?: number) {
	await requireStaffAdmin(c);

	const db = getDb(c.env.DATABASE_URL);

	return runTick(db, {
		limit,
		cooldownHours: resolveRecCooldownHours(c.env.REC_COOLDOWN_HOURS),
		notify: (profileId, notice) => notify(c.env, db, profileId, notice),
	});
}

/** Ids and display names only — never coordinates. */
export async function interactionGraph(c: Context<{ Bindings: CloudflareBindings }>, query: InteractionGraphQuery) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const edges = await repository.listGraphEdges(db, query);
	const degree = new Map<number, number>();

	for (const edge of edges) {
		degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
		degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
	}

	const profiles = await repository.listGraphNodes(db, [...degree.keys()]);

	return {
		nodes: profiles.map((profile) => ({
			id: profile.id,
			name: displayNameForCandidate(profile, `#${profile.id}`),
			isSynthetic: profile.isSynthetic,
			lookingFor: profile.lookingFor,
			degree: degree.get(profile.id) ?? 0,
		})),
		edges,
	};
}

const STATS_DAYS = 30;

/** Aggregates only — no per-user rows. */
export async function stats(c: Context<{ Bindings: CloudflareBindings }>) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const today = utcToday();
	const sinceDay = lastUtcDays(today, STATS_DAYS)[0];
	const since = new Date(`${sinceDay}T00:00:00Z`);

	const [profiles, activity, signups, matches, moods] = await Promise.all([
		repository.profileTotals(db),
		repository.activityTotals(db, today),
		repository.realSignupsByDay(db, since),
		repository.matchesByDay(db, since),
		repository.moodCounts(db, sinceDay),
	]);
	const moodCount = new Map(moods.map((row) => [moodSlug(row.mood), row.count]));

	return {
		days: STATS_DAYS,
		profiles: profiles ?? { total: 0, synthetic: 0, dating: 0 },
		activity,
		signupsByDay: fillDailySeries(signups, today, STATS_DAYS),
		matchesByDay: fillDailySeries(matches, today, STATS_DAYS),
		moods: MoodSlugs.map((mood) => ({ mood, count: moodCount.get(mood) ?? 0 })),
	};
}

/**
 * Components are recomputed from current profile data with the default weights, so they can drift
 * from `storedScore` (written at generation time) after either profile changes.
 */
export async function userRecommendations(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const viewer = await recommendationsRepository.findScoringProfileById(db, profileId);

	if (!viewer) {
		throw errors.not_found;
	}

	const rows = await repository.listRecommendationsForUser(db, profileId);
	const candidateIds = rows.map((row) => row.candidateId);
	const [candidates, crossings] = await Promise.all([
		recommendationsRepository.listScoringProfilesByIds(db, candidateIds),
		recommendationsRepository.listCrossings(db, profileId, candidateIds),
	]);
	const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

	return {
		weights: DEFAULT_WEIGHTS,
		recommendations: rows.flatMap((row) => {
			const candidate = candidateById.get(row.candidateId);

			if (!candidate) {
				return [];
			}

			const breakdown = scoreBreakdown(viewer, candidate);
			const { pUToV, qVToU } = reciprocalScore(viewer, candidate);
			const crossingCount = crossings.get(row.candidateId)?.count ?? 0;

			return [
				{
					candidateId: row.candidateId,
					name: displayNameForCandidate({ ...row, id: row.candidateId }, `#${row.candidateId}`),
					isSynthetic: row.isSynthetic,
					rank: row.rank,
					storedScore: row.score,
					shownAt: row.shownAt.toISOString(),
					actedOn: row.actedOn,
					...breakdown,
					pUToV,
					qVToU,
					crossings: crossingCount,
					score: applyCrossPathsBoost(breakdown.reciprocal, crossingCount),
				},
			];
		}),
	};
}

/** Same batch the feed would build; acted-on rows stay. Resets the user's feed cooldown (new `shown_at`). */
export async function regenerateUserRecommendations(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	await generateRecommendations(getDb(c.env.DATABASE_URL), profileId, { k: CADENCE.batchSize });

	return userRecommendations(c, profileId);
}

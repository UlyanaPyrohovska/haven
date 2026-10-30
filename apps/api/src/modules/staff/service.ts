import type { Context } from "hono";
import { getDb } from "@/db";
import { requireStaffAdmin } from "@/lib/auth/session";
import { fillDailySeries, lastUtcDays } from "@/lib/daily/daily-series";
import { MoodSlugs, moodSlug, utcToday } from "@/lib/daily/mood";
import { errors } from "@/lib/http/service-errors";
import {
	CROSSING_COOLDOWN_HOURS,
	CROSSING_RADIUS_KM,
	CROSSING_WINDOW_MINUTES,
	crossingBlockers,
} from "@/lib/location/crossings";
import { BIO_EMBEDDING_BATCH, embedTexts, syncBioEmbedding } from "@/lib/matching/bio-embedding";
import { type MatchingConfig, resolveMatchingConfig } from "@/lib/matching/matching-config";
import { applyCrossPathsBoost, reciprocalScore, scoreBreakdown } from "@/lib/matching/scoring";
import { displayNameForCandidate } from "@/lib/profile/candidate-display";
import { haversineKm } from "@/lib/profile/profile-view";
import { notify } from "@/modules/notifications/service";
import * as profileRepository from "@/modules/profile/repository";
import type { ProfileUpdate } from "@/modules/profile/schemas";
import { generateRecommendations, withLearnedPreferences } from "@/modules/recommendations/generator";
import * as recommendationsRepository from "@/modules/recommendations/repository";
import { runTick } from "@/modules/simulation/engine";
import * as simulationRepository from "@/modules/simulation/repository";
import * as walkers from "@/modules/simulation/walkers";
import * as repository from "./repository";
import type {
	AssignWalkersBody,
	InteractionGraphQuery,
	StaffUserListQuery,
	StaffUserUpdate,
	UpdateWalkerBody,
} from "./schemas";

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

		if (profileUpdates.bio !== undefined && profileUpdates.bio !== existing.bio) {
			c.executionCtx.waitUntil(
				syncBioEmbedding(c.env.AI, profileRepository.bioEmbeddingStore(db), profileId, updated.bio),
			);
		}
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
		cooldownHours: (await recommendationsRepository.loadMatchingConfig(db, c.env.REC_COOLDOWN_HOURS)).cooldownHours,
		notify: (profileId, notice) => notify(c.env, db, profileId, notice),
	});
}

/**
 * One-off (and after each `db:seed`): re-embeds every bio with bge-small so no vectors from another model
 * remain, and drops vectors whose bio was cleared. Unlike the write path, failures here surface to staff.
 * shortcut: one request does all rows; add an afterId cursor if the pool outgrows Worker subrequest/time limits.
 */
export async function backfillBioEmbeddings(c: Context<{ Bindings: CloudflareBindings }>) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const removed = await profileRepository.deleteClearedBioEmbeddings(db);
	const profiles = await profileRepository.listProfileBios(db);

	for (let i = 0; i < profiles.length; i += BIO_EMBEDDING_BATCH) {
		const batch = profiles.slice(i, i + BIO_EMBEDDING_BATCH);
		const vectors = await embedTexts(
			c.env.AI,
			batch.map((p) => p.bio as string),
		);
		await profileRepository.upsertBioEmbeddings(
			db,
			batch.map((p, j) => ({ userProfileId: p.id, bio: vectors[j] })),
		);
	}

	return { embedded: profiles.length, removed };
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
 * Components are recomputed from current profile data with the current matching config, so they can drift
 * from `storedScore` (written at generation time) after either profile changes.
 */
export async function userRecommendations(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const storedViewer = await recommendationsRepository.findScoringProfileById(db, profileId);

	if (!storedViewer) {
		throw errors.not_found;
	}

	const rows = await repository.listRecommendationsForUser(db, profileId);
	const candidateIds = rows.map((row) => row.candidateId);
	const [storedCandidates, crossings, config] = await Promise.all([
		recommendationsRepository.listScoringProfilesByIds(db, candidateIds),
		recommendationsRepository.listCrossings(db, profileId, candidateIds),
		recommendationsRepository.loadMatchingConfig(db),
	]);
	const [viewer, ...candidates] = await withLearnedPreferences(
		db,
		[storedViewer, ...storedCandidates],
		config.preferenceLambda,
	);
	const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

	return {
		weights: config.weights,
		recommendations: rows.flatMap((row) => {
			const candidate = candidateById.get(row.candidateId);

			if (!candidate) {
				return [];
			}

			const breakdown = scoreBreakdown(viewer, candidate, config.weights);
			const { pUToV, qVToU } = reciprocalScore(viewer, candidate, config.weights);
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
					score: applyCrossPathsBoost(breakdown.reciprocal, crossingCount, config.crossPathsLambda),
				},
			];
		}),
	};
}

/** Same batch the feed would build; acted-on rows stay. Resets the user's feed cooldown (new `shown_at`). */
export async function regenerateUserRecommendations(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	await generateRecommendations(getDb(c.env.DATABASE_URL), profileId);

	return userRecommendations(c, profileId);
}

async function matchingConfigResponse(c: Context<{ Bindings: CloudflareBindings }>) {
	const db = getDb(c.env.DATABASE_URL);
	const row = await recommendationsRepository.findMatchingConfigRow(db);

	return {
		config: resolveMatchingConfig(row, c.env.REC_COOLDOWN_HOURS),
		defaults: resolveMatchingConfig(null, c.env.REC_COOLDOWN_HOURS),
		updatedAt: row?.updatedAt.toISOString() ?? null,
		updatedBy: row?.updatedBy ?? null,
	};
}

export async function getMatchingConfig(c: Context<{ Bindings: CloudflareBindings }>) {
	await requireStaffAdmin(c);

	return matchingConfigResponse(c);
}

/** Applies to the next batch generated; existing recommendations keep their stored scores. */
export async function updateMatchingConfig(c: Context<{ Bindings: CloudflareBindings }>, config: MatchingConfig) {
	const session = await requireStaffAdmin(c);
	await recommendationsRepository.saveMatchingConfig(getDb(c.env.DATABASE_URL), config, session.user.id);

	return matchingConfigResponse(c);
}

/** Must match the walker cron in wrangler.jsonc. */
const WALKER_STEP_MINUTES = 10;

type Db = ReturnType<typeof getDb>;
type WalkerProfile = simulationRepository.WalkerProfile;

function profileName(profile: Pick<WalkerProfile, "id" | "displayName" | "gender" | "isSynthetic">) {
	return displayNameForCandidate(profile, `#${profile.id}`);
}

function serializeCrossing(crossing: { count: number; lastCrossedAt: Date | null; lastPlace: string | null }) {
	return {
		count: crossing.count,
		lastCrossedAt: crossing.lastCrossedAt?.toISOString() ?? null,
		lastPlace: crossing.lastPlace,
	};
}

/** Staff see exact coordinates here (as on user detail); the app never does. */
async function walkersOverview(
	db: Db,
	targetId: number,
	lastAction: { assigned?: number; stepped?: number; crossingsRecorded: number } | null = null,
) {
	const [target] = await simulationRepository.findWalkerProfiles(db, [targetId]);

	if (!target) {
		throw errors.not_found;
	}

	const [walks, crossingRows, ownWalk] = await Promise.all([
		simulationRepository.listWalkers(db, { targetId }),
		simulationRepository.listCrossingsOf(db, targetId),
		simulationRepository.findWalk(db, targetId),
	]);
	const others = await simulationRepository.findWalkerProfiles(db, [
		...crossingRows.map((row) => row.otherId),
		...(ownWalk ? [ownWalk.targetId] : []),
	]);
	const otherById = new Map(others.map((profile) => [profile.id, profile]));
	const crossingByOther = new Map(crossingRows.map((row) => [row.otherId, row]));
	const walkerIds = new Set(walks.map((row) => row.walk.walkerId));
	const now = new Date();
	const ownTarget = ownWalk ? otherById.get(ownWalk.targetId) : undefined;

	return {
		rules: {
			crossingRadiusM: CROSSING_RADIUS_KM * 1000,
			windowMinutes: CROSSING_WINDOW_MINUTES,
			cooldownHours: CROSSING_COOLDOWN_HOURS,
			stepEveryMinutes: WALKER_STEP_MINUTES,
		},
		target: {
			profileId: target.id,
			name: profileName(target),
			isSynthetic: target.isSynthetic,
			lookingFor: target.lookingFor,
			latitude: target.latitude,
			longitude: target.longitude,
			displayLocation: target.displayLocation,
			locationUpdatedAt: target.locationUpdatedAt?.toISOString() ?? null,
			shareCrossPaths: target.shareCrossPaths,
			locationHidden: target.locationHidden,
		},
		walkingFor: ownWalk
			? { targetId: ownWalk.targetId, name: ownTarget ? profileName(ownTarget) : `#${ownWalk.targetId}` }
			: null,
		walkers: walks.map(({ walk, profile }) => {
			const km = target.locationHidden
				? undefined
				: haversineKm(profile.latitude, profile.longitude, target.latitude, target.longitude);
			const crossing = crossingByOther.get(walk.walkerId);

			return {
				walkerId: walk.walkerId,
				name: profileName(profile),
				latitude: profile.latitude,
				longitude: profile.longitude,
				locationUpdatedAt: profile.locationUpdatedAt?.toISOString() ?? null,
				centerLat: walk.centerLat,
				centerLon: walk.centerLon,
				radiusM: walk.radiusM,
				stepM: walk.stepM,
				active: walk.active,
				lastStepAt: walk.lastStepAt?.toISOString() ?? null,
				createdAt: walk.createdAt.toISOString(),
				createdBy: walk.createdBy,
				distanceToTargetM: km === undefined ? null : Math.round(km * 1000),
				blockers: [...(walk.active ? [] : ["paused"]), ...crossingBlockers(profile, target, now)],
				crossing: crossing ? serializeCrossing(crossing) : null,
			};
		}),
		crossings: crossingRows.map((row) => {
			const other = otherById.get(row.otherId);

			return {
				otherId: row.otherId,
				name: other ? profileName(other) : `#${row.otherId}`,
				isSynthetic: other?.isSynthetic ?? false,
				isWalker: walkerIds.has(row.otherId),
				...serializeCrossing(row),
			};
		}),
		lastAction,
	};
}

export async function getWalkers(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);

	return walkersOverview(getDb(c.env.DATABASE_URL), profileId);
}

export async function assignWalkers(
	c: Context<{ Bindings: CloudflareBindings }>,
	profileId: number,
	body: AssignWalkersBody,
) {
	const session = await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);
	const result = await walkers.assignWalkers(db, profileId, { ...body, createdBy: session.user.id });

	return walkersOverview(db, profileId, result);
}

export async function stepWalkers(
	c: Context<{ Bindings: CloudflareBindings }>,
	profileId: number,
	body: { markTargetPresent?: boolean },
) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	if (body.markTargetPresent) {
		const [target] = await simulationRepository.findWalkerProfiles(db, [profileId]);

		if (!target) {
			throw errors.not_found;
		}

		// Only the timestamp changes: the target's coordinates stay what their app last reported.
		await simulationRepository.setProfileLocation(db, profileId, {
			latitude: target.latitude,
			longitude: target.longitude,
			locationUpdatedAt: new Date(),
		});
	}

	return walkersOverview(db, profileId, await walkers.stepWalkers(db, { targetId: profileId }));
}

export async function updateWalker(
	c: Context<{ Bindings: CloudflareBindings }>,
	walkerId: number,
	body: UpdateWalkerBody,
) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);
	const walk = await simulationRepository.findWalk(db, walkerId);

	if (!walk) {
		throw errors.not_found;
	}

	await simulationRepository.updateWalk(db, walkerId, body);

	return walkersOverview(db, walk.targetId);
}

export async function deleteWalker(c: Context<{ Bindings: CloudflareBindings }>, walkerId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);
	const walk = await simulationRepository.findWalk(db, walkerId);

	if (!walk) {
		throw errors.not_found;
	}

	await walkers.removeWalker(db, walkerId);

	return walkersOverview(db, walk.targetId);
}

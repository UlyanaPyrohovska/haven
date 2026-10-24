import type { Context } from "hono";
import { type Db, getDb } from "@/db";
import { resolveProfilePhotoUrl } from "@/lib/avatar-url";
import { resolveCandidateDailyAnswer } from "@/lib/candidate-daily-answer";
import { displayNameForCandidate } from "@/lib/candidate-display";
import { resolveCandidateMood } from "@/lib/candidate-mood";
import { dailyQuestion } from "@/lib/daily-questions";
import { errors } from "@/lib/errors";
import { matchReasons } from "@/lib/match-reasons";
import { utcToday } from "@/lib/mood";
import {
	candidateLocationLabel,
	haversineKm,
	isProfileComplete,
	type ProfileRow,
	publicProfileFields,
	readPrivacySettings,
	sharedInterestLabels,
	shouldShowCrossPaths,
} from "@/lib/profile-view";
import type { PushEnv } from "@/lib/push";
import { CADENCE, isCooldownElapsed, nextRefreshAtIso, resolveRecCooldownHours } from "@/lib/recommendation-cadence";
import { scoreBreakdown } from "@/lib/scoring";
import { getSessionUserId } from "@/lib/session";
import * as chatRepository from "@/modules/chat/repository";
import { ensureSyntheticOpener, toMessagePayload } from "@/modules/chat/service";
import * as dailyQuestionRepository from "@/modules/daily-question/repository";
import { notify } from "@/modules/notifications/service";
import { generateRecommendations } from "./generator";
import * as repository from "./repository";
import type { DecisionBody } from "./schemas";

export type ViewerContext = {
	db: Db;
	viewer: repository.ViewerProfile;
	recCooldownHours: number;
};

export async function requireViewer(c: Context<{ Bindings: CloudflareBindings }>): Promise<ViewerContext> {
	const authUserId = await getSessionUserId(c);

	if (!authUserId) {
		throw errors.unauthorized;
	}

	const db = getDb(c.env.DATABASE_URL);
	const viewer = await repository.findViewerByUserId(db, authUserId);

	if (!viewer) {
		throw errors.no_profile;
	}

	return {
		db,
		viewer,
		recCooldownHours: resolveRecCooldownHours(c.env.REC_COOLDOWN_HOURS),
	};
}

function summariseCandidate(
	viewer: ProfileRow,
	candidate: repository.ViewerProfile,
	recommendation: { id: number; rank: number | null; score: number | null },
) {
	const publicFields = publicProfileFields(viewer, candidate);

	return {
		recommendationId: recommendation.id,
		candidateId: candidate.id,
		rank: recommendation.rank ?? 0,
		score: recommendation.score ?? 0,
		displayName: displayNameForCandidate({
			id: candidate.id,
			displayName: candidate.displayName as string | null | undefined,
			gender: candidate.gender as number | null | undefined,
			isSynthetic: Boolean(candidate.isSynthetic),
		}),
		photoUrl: resolveProfilePhotoUrl(candidate),
		ageLabel: publicFields.ageLabel,
		career: publicFields.career,
		topInterests: publicFields.topInterests,
		sharedInterests: publicFields.sharedInterests,
	};
}

type EnsureBatchResult =
	| { status: "generated"; count: number }
	| { status: "cooldown"; nextRefreshAt?: string }
	| { status: "skipped" };

/** Daily-drop rule: a new batch only when nothing is pending, the profile is complete and the cooldown elapsed. */
export async function ensureBatch(
	db: Db,
	viewer: repository.ViewerProfile,
	recCooldownHours: number,
): Promise<EnsureBatchResult> {
	const pending = await repository.countPendingRecommendations(db, viewer.id);

	if (pending > 0 || !isProfileComplete(viewer)) {
		return { status: "skipped" };
	}

	const lastShown = await repository.getLastBatchShownAt(db, viewer.id);

	if (!isCooldownElapsed(lastShown, recCooldownHours)) {
		return { status: "cooldown", nextRefreshAt: lastShown ? nextRefreshAtIso(lastShown, recCooldownHours) : undefined };
	}

	return { status: "generated", count: await generateRecommendations(db, viewer.id, { k: CADENCE.batchSize }) };
}

export async function getRecommendations({ db, viewer, recCooldownHours }: ViewerContext) {
	let nextRefreshAt: string | undefined;

	const batch = await ensureBatch(db, viewer, recCooldownHours);

	if (batch.status === "cooldown") {
		nextRefreshAt = batch.nextRefreshAt;
	}

	const rows = await repository.listPendingRecommendations(db, viewer.id);

	const summaries = rows.map(({ recommendation, candidate }) =>
		summariseCandidate(viewer, candidate as repository.ViewerProfile, recommendation),
	);

	const todayQuestion = dailyQuestion(utcToday());

	return {
		recommendations: summaries,
		count: summaries.length,
		dailyQuestion: todayQuestion,
		...(nextRefreshAt ? { nextRefreshAt } : {}),
	};
}

/**
 * A match can outlive its recommendation row (seeded matches, pending rows replaced by a new batch),
 * so the profile opened from chat falls back to the matched interaction.
 */
async function matchWithoutRecommendation(db: Db, viewerId: number, candidateId: number) {
	const interaction = await repository.findInteractionBetween(db, viewerId, candidateId);
	const candidate = interaction?.match ? await repository.findCandidateProfile(db, candidateId) : null;

	return candidate ? { recommendation: { id: 0, rank: null, score: null, actedOn: true }, candidate } : null;
}

export async function getRecommendationDetail({ db, viewer }: ViewerContext, candidateId: number) {
	const row =
		(await repository.findRecommendationWithCandidate(db, viewer.id, candidateId)) ??
		(await matchWithoutRecommendation(db, viewer.id, candidateId));

	if (!row) {
		throw errors.not_found;
	}

	const candidate = row.candidate as repository.ViewerProfile;
	const isSynthetic = Boolean(candidate.isSynthetic);
	const mood = await resolveCandidateMood(db, candidate.id, isSynthetic);
	const today = utcToday();
	const viewerAnswer = await dailyQuestionRepository.findAnswerForDate(db, viewer.id, today);
	const viewerHasAnswered = Boolean(viewerAnswer?.answer?.trim());
	const answerLocked = !viewerHasAnswered;
	const questionAnswer = viewerHasAnswered ? await resolveCandidateDailyAnswer(db, candidate.id, isSynthetic) : null;
	const summary = summariseCandidate(viewer, candidate, row.recommendation);
	const crossing = shouldShowCrossPaths(viewer, candidate)
		? (await repository.listCrossings(db, viewer.id, [candidate.id])).get(candidate.id)
		: undefined;
	const publicFields = publicProfileFields(viewer, candidate);
	const shareLocation = readPrivacySettings(candidate).shareLocation;
	const distance = shareLocation
		? haversineKm(
				viewer.latitude as number | null,
				viewer.longitude as number | null,
				candidate.latitude as number | null,
				candidate.longitude as number | null,
			)
		: undefined;

	const interaction = await repository.findInteractionBetween(db, viewer.id, candidate.id);
	const match = interaction?.match
		? await describeMatch(db, viewer, candidate, {
				matchedAt: interaction.createdAt,
				shareLocation,
				crossPathsCount: crossing?.count ?? null,
			})
		: null;

	return {
		recommendationId: summary.recommendationId,
		candidateId: summary.candidateId,
		rank: summary.rank,
		score: summary.score,
		displayName: summary.displayName,
		photoUrl: summary.photoUrl,
		ageLabel: summary.ageLabel,
		career: summary.career,
		bio: publicFields.bio,
		interests: publicFields.interests,
		sharedInterests: summary.sharedInterests,
		dailyQuestion: dailyQuestion(today),
		questionAnswer,
		answerLocked,
		crossPathsCount: crossing?.count ?? null,
		crossPathsPlace: crossing?.lastPlace ?? null,
		crossPathsLastAt: crossing?.lastCrossedAt?.toISOString() ?? null,
		distanceKm: distance,
		locationLabel: candidateLocationLabel(viewer, candidate),
		actedOn: row.recommendation.actedOn,
		mood,
		isSynthetic,
		match,
	};
}

/** Why two matched profiles fit, from the same scoring the recommender used. */
async function describeMatch(
	db: Db,
	viewer: repository.ViewerProfile,
	candidate: repository.ViewerProfile,
	context: { matchedAt: Date; shareLocation: boolean; crossPathsCount: number | null },
) {
	const profiles = await repository.listScoringProfilesByIds(db, [viewer.id, candidate.id]);
	const viewerScoring = profiles.find((profile) => profile.id === viewer.id);
	const candidateScoring = profiles.find((profile) => profile.id === candidate.id);

	if (!viewerScoring || !candidateScoring) {
		return null;
	}

	const breakdown = scoreBreakdown(viewerScoring, candidateScoring);
	const sharedInterestCount = readPrivacySettings(candidate).showInterests
		? sharedInterestLabels(viewer, candidate).length
		: 0;

	return {
		matchedAt: context.matchedAt.toISOString(),
		compatibility: breakdown.reciprocal,
		reasons: matchReasons(breakdown, {
			sharedInterestCount,
			shareLocation: context.shareLocation,
			crossPathsCount: context.crossPathsCount,
		}),
	};
}

export async function postDecision(
	{ db, viewer }: ViewerContext,
	candidateId: number,
	body: DecisionBody,
	env: PushEnv,
	waitUntil: (task: Promise<unknown>) => void,
) {
	const pendingId = await repository.findPendingRecommendationId(db, viewer.id, candidateId);

	if (!pendingId) {
		throw errors.not_found;
	}

	const { matched } = await recordDecision(
		db,
		{ id: viewer.id, latitude: viewer.latitude as number | null, longitude: viewer.longitude as number | null },
		candidateId,
		body.decision === "accept" ? 1 : 0,
	);

	await repository.markRecommendationActedOn(db, pendingId);

	// The viewer sees the match on screen; the other side learns about it by push.
	if (matched) {
		waitUntil(notify(env, db, candidateId, { kind: "match", candidateId: viewer.id }));
	}

	const remainingCount = await repository.countPendingRecommendations(db, viewer.id);

	return { matched, remainingCount };
}

/** Writes one side of the directed pair; a match is both sides accepting. Shared with the simulation engine. */
export async function recordDecision(
	db: Db,
	actor: { id: number; latitude: number | null; longitude: number | null },
	otherId: number,
	decisionValue: 0 | 1,
): Promise<{ matched: boolean }> {
	const existingInteraction = await repository.findInteractionBetween(db, actor.id, otherId);

	if (existingInteraction) {
		const actorIsA = existingInteraction.userA === actor.id;
		const updates = actorIsA ? { decA: decisionValue } : { decB: decisionValue };
		const decA = actorIsA ? decisionValue : existingInteraction.decA;
		const decB = actorIsA ? existingInteraction.decB : decisionValue;
		const matched = decA === 1 && decB === 1;

		await repository.updateInteraction(db, existingInteraction.id, { ...updates, match: matched });

		return { matched };
	}

	const otherProfile = await repository.findCandidateCoordinates(db, otherId);
	const distance = haversineKm(
		actor.latitude,
		actor.longitude,
		otherProfile?.latitude ?? null,
		otherProfile?.longitude ?? null,
	);

	await repository.insertInteraction(db, {
		userA: actor.id,
		userB: otherId,
		decA: decisionValue,
		decB: null,
		match: false,
		distanceKm: distance ?? null,
	});

	return { matched: false };
}

/**
 * When onboarding completes, seed the first batch without waiting for GET /recommendations.
 * Skips cooldown — only runs on the transition to a complete profile with no pending recs.
 */
export async function maybeGenerateOnProfileComplete(
	db: Db,
	profile: ProfileRow & { id: number },
	wasComplete: boolean,
) {
	if (wasComplete || !isProfileComplete(profile)) {
		return;
	}

	const pending = await repository.countPendingRecommendations(db, profile.id);

	if (pending > 0) {
		return;
	}

	try {
		await generateRecommendations(db, profile.id, { k: CADENCE.batchSize });
	} catch (err) {
		console.error("maybeGenerateOnProfileComplete failed", err);
	}
}

/** Study knob: drop un-acted recs and generate a fresh batch (ignores cooldown). */
export async function regenerate({ db, viewer }: ViewerContext) {
	if (!isProfileComplete(viewer)) {
		return { count: 0 };
	}

	const count = await generateRecommendations(db, viewer.id, { k: CADENCE.batchSize });

	return { count };
}

/** Filters changed: drop pending people who no longer fit, without refilling the batch. */
export function dismissPendingFilterMisfits(db: Db, profileId: number) {
	return repository.dismissPendingFilterMisfits(db, profileId);
}

export async function getMatches({ db, viewer }: ViewerContext) {
	const interactionRows = await repository.listMatchInteractions(db, viewer.id);
	const stats = await chatRepository.listInboxStats(
		db,
		interactionRows.map((interaction) => interaction.id),
		viewer.id,
	);

	const matches = await Promise.all(
		interactionRows.map(async (interaction) => {
			const candidateId = interaction.userA === viewer.id ? interaction.userB : interaction.userA;
			const candidate = await repository.findCandidateProfile(db, candidateId);

			if (!candidate) {
				return null;
			}

			const publicFields = publicProfileFields(viewer, candidate);
			const conversation = stats.get(interaction.id);
			const lastMessage =
				conversation?.lastMessage ??
				(await ensureSyntheticOpener(db, interaction.id, viewer, { ...candidate, id: candidateId }, false));
			const matchedAt = interaction.createdAt.toISOString();

			return {
				candidateId,
				displayName: displayNameForCandidate({
					id: candidateId,
					displayName: candidate.displayName as string | null | undefined,
					gender: candidate.gender as number | null | undefined,
					isSynthetic: Boolean(candidate.isSynthetic),
				}),
				photoUrl: resolveProfilePhotoUrl({ ...candidate, id: candidateId }),
				ageLabel: publicFields.ageLabel,
				topInterests: publicFields.topInterests,
				matchedAt,
				isSynthetic: Boolean(candidate.isSynthetic),
				lastMessage: lastMessage ? toMessagePayload(lastMessage) : null,
				// A fresh synthetic opener is unread too.
				unreadCount: conversation?.lastMessage ? conversation.unreadCount : lastMessage ? 1 : 0,
				lastActivityAt: lastMessage ? lastMessage.createdAt.toISOString() : matchedAt,
			};
		}),
	);

	const resolved = matches
		.filter((match): match is NonNullable<typeof match> => match !== null)
		.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

	return { matches: resolved, count: resolved.length };
}

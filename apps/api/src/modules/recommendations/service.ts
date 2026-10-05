import type { Context } from "hono";
import { type Db, getDb } from "@/db";
import { resolveProfilePhotoUrl } from "@/lib/avatar-url";
import { resolveCandidateDailyAnswer } from "@/lib/candidate-daily-answer";
import { displayNameForCandidate } from "@/lib/candidate-display";
import { resolveCandidateMood } from "@/lib/candidate-mood";
import { dailyQuestion } from "@/lib/daily-questions";
import { errors } from "@/lib/errors";
import { utcToday } from "@/lib/mood";
import {
	candidateLocationLabel,
	haversineKm,
	isProfileComplete,
	type ProfileRow,
	publicProfileFields,
	readPrivacySettings,
	shouldShowCrossPaths,
} from "@/lib/profile-view";
import { CADENCE, isCooldownElapsed, nextRefreshAtIso, resolveRecCooldownHours } from "@/lib/recommendation-cadence";
import { getSessionUserId } from "@/lib/session";
import * as dailyQuestionRepository from "@/modules/daily-question/repository";
import { generateRecommendations } from "./generator";
import * as repository from "./repository";
import type { DecisionBody } from "./schemas";

export type ViewerContext = {
	db: Db;
	viewer: repository.ViewerProfile;
	recCooldownHours: number;
};

function crossPathsCountFor(viewer: ProfileRow, candidate: ProfileRow): number | null {
	if (!shouldShowCrossPaths(viewer, candidate)) {
		return null;
	}

	// W1.6: return crossing count from DB.
	return null;
}

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
		crossPathsCount: crossPathsCountFor(viewer, candidate),
	};
}

export async function getRecommendations({ db, viewer, recCooldownHours }: ViewerContext) {
	let nextRefreshAt: string | undefined;

	const pending = await repository.countPendingRecommendations(db, viewer.id);

	if (pending === 0 && isProfileComplete(viewer)) {
		const lastShown = await repository.getLastBatchShownAt(db, viewer.id);

		if (isCooldownElapsed(lastShown, recCooldownHours)) {
			await generateRecommendations(db, viewer.id, { k: CADENCE.batchSize });
		} else if (lastShown) {
			nextRefreshAt = nextRefreshAtIso(lastShown, recCooldownHours);
		}
	}

	const rows = await repository.listPendingRecommendations(db, viewer.id);

	const summaries = rows.map(({ recommendation, candidate }) =>
		summariseCandidate(viewer, candidate as repository.ViewerProfile, recommendation),
	);

	const todayQuestion = dailyQuestion(utcToday());

	return {
		recommendations: summaries.map(({ crossPathsCount: _cp, ...summary }) => summary),
		count: summaries.length,
		dailyQuestion: todayQuestion,
		...(nextRefreshAt ? { nextRefreshAt } : {}),
	};
}

export async function getRecommendationDetail({ db, viewer }: ViewerContext, candidateId: number) {
	const row = await repository.findRecommendationWithCandidate(db, viewer.id, candidateId);

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
		crossPathsCount: summary.crossPathsCount,
		distanceKm: distance,
		locationLabel: candidateLocationLabel(viewer, candidate),
		actedOn: row.recommendation.actedOn,
		mood,
		isSynthetic,
	};
}

export async function postDecision({ db, viewer }: ViewerContext, candidateId: number, body: DecisionBody) {
	const pendingId = await repository.findPendingRecommendationId(db, viewer.id, candidateId);

	if (!pendingId) {
		throw errors.not_found;
	}

	const decisionValue = body.decision === "accept" ? 1 : 0;
	const existingInteraction = await repository.findInteractionBetween(db, viewer.id, candidateId);
	const candidateProfile = await repository.findCandidateCoordinates(db, candidateId);

	const distance = haversineKm(
		viewer.latitude as number | null,
		viewer.longitude as number | null,
		candidateProfile?.latitude ?? null,
		candidateProfile?.longitude ?? null,
	);

	let matched = false;

	if (existingInteraction) {
		const viewerIsA = existingInteraction.userA === viewer.id;
		const updates = viewerIsA ? { decA: decisionValue } : { decB: decisionValue };
		const decA = viewerIsA ? decisionValue : existingInteraction.decA;
		const decB = viewerIsA ? existingInteraction.decB : decisionValue;
		matched = decA === 1 && decB === 1;

		await repository.updateInteraction(db, existingInteraction.id, { ...updates, match: matched });
	} else {
		await repository.insertInteraction(db, {
			userA: viewer.id,
			userB: candidateId,
			decA: decisionValue,
			decB: null,
			match: false,
			distanceKm: distance ?? null,
		});
	}

	await repository.markRecommendationActedOn(db, pendingId);

	const remainingCount = await repository.countPendingRecommendations(db, viewer.id);

	return { matched, remainingCount };
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

export async function getMatches({ db, viewer }: ViewerContext) {
	const interactionRows = await repository.listMatchInteractions(db, viewer.id);

	const matches = await Promise.all(
		interactionRows.map(async (interaction) => {
			const candidateId = interaction.userA === viewer.id ? interaction.userB : interaction.userA;
			const candidate = await repository.findCandidateProfile(db, candidateId);

			if (!candidate) {
				return null;
			}

			const publicFields = publicProfileFields(viewer, candidate);

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
				matchedAt: interaction.createdAt.toISOString(),
			};
		}),
	);

	const resolved = matches.filter((match): match is NonNullable<typeof match> => match !== null);

	return { matches: resolved, count: resolved.length };
}

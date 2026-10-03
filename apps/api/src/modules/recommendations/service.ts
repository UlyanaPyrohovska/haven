import type { Context } from "hono";
import { type Db, getDb } from "@/db";
import { resolveProfilePhotoUrl } from "@/lib/avatar-url";
import { resolveCandidateMood } from "@/lib/candidate-mood";
import { errors } from "@/lib/errors";
import {
	candidateLocationLabel,
	haversineKm,
	type ProfileRow,
	publicProfileFields,
	readPrivacySettings,
	shouldShowCrossPaths,
} from "@/lib/profile-view";
import { DEMO_DAILY_QUESTION, demoPresentation, displayNameForCandidate } from "@/lib/recommendation-demo-data";
import { getSessionUserId } from "@/lib/session";
import * as repository from "./repository";
import type { DecisionBody } from "./schemas";

export type ViewerContext = {
	db: Db;
	viewer: repository.ViewerProfile;
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

	return { db, viewer };
}

function summariseCandidate(
	viewer: ProfileRow,
	candidate: repository.ViewerProfile,
	recommendation: { id: number; rank: number | null; score: number | null },
) {
	const publicFields = publicProfileFields(viewer, candidate);
	const presentation = demoPresentation(candidate.id);

	return {
		recommendationId: recommendation.id,
		candidateId: candidate.id,
		rank: recommendation.rank ?? 0,
		score: recommendation.score ?? 0,
		displayName: displayNameForCandidate(candidate.id),
		photoUrl: resolveProfilePhotoUrl(candidate),
		ageLabel: publicFields.ageLabel,
		career: publicFields.career,
		topInterests: publicFields.topInterests,
		sharedInterests: publicFields.sharedInterests,
		questionAnswer: presentation?.questionAnswer ?? "",
		crossPathsCount: shouldShowCrossPaths(viewer, candidate) ? (presentation?.crossPathsCount ?? 1) : null,
	};
}

export async function getRecommendations({ db, viewer }: ViewerContext) {
	const rows = await repository.listPendingRecommendations(db, viewer.id);

	const summaries = rows.map(({ recommendation, candidate }) =>
		summariseCandidate(viewer, candidate as repository.ViewerProfile, recommendation),
	);

	return {
		recommendations: summaries.map(({ questionAnswer: _qa, crossPathsCount: _cp, ...summary }) => summary),
		count: summaries.length,
		dailyQuestion: DEMO_DAILY_QUESTION,
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
		dailyQuestion: DEMO_DAILY_QUESTION,
		questionAnswer: summary.questionAnswer,
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
				displayName: displayNameForCandidate(candidateId),
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

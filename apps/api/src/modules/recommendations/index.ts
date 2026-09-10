import { createRoute, z } from "@hono/zod-openapi";
import { and, asc, eq, getTableColumns, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { interactions, recommendations, userProfiles } from "@/db/schema";
import { resolveProfilePhotoUrl } from "@/lib/avatar-url";
import { createOpenAPIApp } from "@/lib/openapi";
import {
	ageLabel,
	haversineKm,
	interestLabels,
	type ProfileRow,
	profileAge,
	sharedInterestLabels,
} from "@/lib/profile-view";
import { DEMO_DAILY_QUESTION, demoPresentation, displayNameForCandidate } from "@/lib/recommendation-demo-data";
import { getSessionUserId, UNAUTHORIZED } from "@/lib/session";
import {
	DecisionBodySchema,
	DecisionResponseSchema,
	ErrorSchema,
	MatchesListSchema,
	RecommendationDetailSchema,
	RecommendationsListSchema,
} from "./recommendations-schema";

const { email: _email, passwordHash: _passwordHash, ...publicProfileColumns } = getTableColumns(userProfiles);

const NOT_FOUND = { code: "NOT_FOUND", message: "Resource not found" } as const;
const NO_PROFILE = { code: "NO_PROFILE", message: "Complete onboarding before browsing connections" } as const;

export const recommendationsModule = createOpenAPIApp();

async function requireViewerProfile(c: Parameters<typeof getSessionUserId>[0]) {
	const authUserId = await getSessionUserId(c);

	if (!authUserId) {
		return { error: c.json(UNAUTHORIZED, 401) } as const;
	}

	const db = getDb(c.env.DATABASE_URL);
	const [viewer] = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(eq(userProfiles.userId, authUserId))
		.limit(1);

	if (!viewer) {
		return { error: c.json(NO_PROFILE, 400) } as const;
	}

	return { db, viewer: viewer as ProfileRow & { id: number } } as const;
}

function summariseCandidate(
	viewer: ProfileRow,
	candidate: ProfileRow & { id: number },
	recommendation: { id: number; rank: number | null; score: number | null },
) {
	const age = profileAge(candidate.birthDate);
	const interests = interestLabels(candidate);
	const shared = sharedInterestLabels(viewer, candidate);
	const presentation = demoPresentation(candidate.id);

	return {
		recommendationId: recommendation.id,
		candidateId: candidate.id,
		rank: recommendation.rank ?? 0,
		score: recommendation.score ?? 0,
		displayName: displayNameForCandidate(candidate.id),
		photoUrl: resolveProfilePhotoUrl(candidate),
		ageLabel: age === undefined ? undefined : ageLabel(age),
		career: typeof candidate.career === "string" ? candidate.career : null,
		topInterests: interests.slice(0, 3),
		sharedInterests: shared.length > 0 ? shared.slice(0, 6) : interests.slice(0, 3),
		questionAnswer: presentation?.questionAnswer ?? "",
		crossPathsCount: presentation?.crossPathsCount ?? 1,
	};
}

function locationLabel(viewer: ProfileRow, candidate: ProfileRow): string | undefined {
	const distance = haversineKm(
		viewer.latitude as number | null,
		viewer.longitude as number | null,
		candidate.latitude as number | null,
		candidate.longitude as number | null,
	);

	if (distance === undefined) {
		return undefined;
	}

	if (distance < 5) {
		return "Setúbal, Portugal";
	}

	return `${distance.toFixed(0)} km away`;
}

const listRecommendations = createRoute({
	method: "get",
	path: "/recommendations",
	tags: ["Recommendations"],
	summary: "Pending connection recommendations",
	responses: {
		200: {
			content: { "application/json": { schema: RecommendationsListSchema } },
			description: "Recommendations",
		},
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: ErrorSchema } }, description: "No profile" },
	},
});

recommendationsModule.openapi(listRecommendations, async (c) => {
	const result = await requireViewerProfile(c);

	if ("error" in result) {
		return result.error;
	}

	const { db, viewer } = result;

	const rows = await db
		.select({
			recommendation: recommendations,
			candidate: publicProfileColumns,
		})
		.from(recommendations)
		.innerJoin(userProfiles, eq(userProfiles.id, recommendations.candidateId))
		.where(and(eq(recommendations.userId, viewer.id), eq(recommendations.actedOn, false)))
		.orderBy(asc(recommendations.rank));

	const summaries = rows.map(({ recommendation, candidate }) =>
		summariseCandidate(viewer, candidate as ProfileRow & { id: number }, recommendation),
	);

	return c.json(
		{
			recommendations: summaries.map(({ questionAnswer: _qa, crossPathsCount: _cp, ...summary }) => summary),
			count: summaries.length,
			dailyQuestion: DEMO_DAILY_QUESTION,
		},
		200,
	);
});

const getRecommendation = createRoute({
	method: "get",
	path: "/recommendations/{candidateId}",
	tags: ["Recommendations"],
	summary: "Connection detail for a candidate",
	request: {
		params: z.object({
			candidateId: z.coerce.number().int(),
		}),
	},
	responses: {
		200: {
			content: { "application/json": { schema: RecommendationDetailSchema } },
			description: "Recommendation detail",
		},
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

recommendationsModule.openapi(getRecommendation, async (c) => {
	const result = await requireViewerProfile(c);

	if ("error" in result) {
		return result.error;
	}

	const { db, viewer } = result;
	const candidateId = c.req.valid("param").candidateId;

	const [row] = await db
		.select({
			recommendation: recommendations,
			candidate: publicProfileColumns,
		})
		.from(recommendations)
		.innerJoin(userProfiles, eq(userProfiles.id, recommendations.candidateId))
		.where(and(eq(recommendations.userId, viewer.id), eq(recommendations.candidateId, candidateId)))
		.limit(1);

	if (!row) {
		return c.json(NOT_FOUND, 404);
	}

	const summary = summariseCandidate(viewer, row.candidate as ProfileRow & { id: number }, row.recommendation);
	const distance = haversineKm(
		viewer.latitude as number | null,
		viewer.longitude as number | null,
		row.candidate.latitude as number | null,
		row.candidate.longitude as number | null,
	);

	return c.json(
		{
			recommendationId: summary.recommendationId,
			candidateId: summary.candidateId,
			rank: summary.rank,
			score: summary.score,
			displayName: summary.displayName,
			photoUrl: summary.photoUrl,
			ageLabel: summary.ageLabel,
			career: summary.career,
			bio: typeof row.candidate.bio === "string" ? row.candidate.bio : null,
			interests: interestLabels(row.candidate as ProfileRow),
			sharedInterests: summary.sharedInterests,
			dailyQuestion: DEMO_DAILY_QUESTION,
			questionAnswer: summary.questionAnswer,
			crossPathsCount: summary.crossPathsCount,
			distanceKm: distance,
			locationLabel: locationLabel(viewer, row.candidate as ProfileRow),
			actedOn: row.recommendation.actedOn,
		},
		200,
	);
});

const postDecision = createRoute({
	method: "post",
	path: "/recommendations/{candidateId}/decision",
	tags: ["Recommendations"],
	summary: "Accept or decline a recommendation",
	request: {
		params: z.object({
			candidateId: z.coerce.number().int(),
		}),
		body: { content: { "application/json": { schema: DecisionBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: DecisionResponseSchema } },
			description: "Decision recorded",
		},
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

recommendationsModule.openapi(postDecision, async (c) => {
	const result = await requireViewerProfile(c);

	if ("error" in result) {
		return result.error;
	}

	const { db, viewer } = result;
	const candidateId = c.req.valid("param").candidateId;
	const { decision } = c.req.valid("json");
	const decisionValue = decision === "accept" ? 1 : 0;

	const [pending] = await db
		.select({ id: recommendations.id })
		.from(recommendations)
		.where(
			and(
				eq(recommendations.userId, viewer.id),
				eq(recommendations.candidateId, candidateId),
				eq(recommendations.actedOn, false),
			),
		)
		.limit(1);

	if (!pending) {
		return c.json(NOT_FOUND, 404);
	}

	const [existingInteraction] = await db
		.select()
		.from(interactions)
		.where(
			or(
				and(eq(interactions.userA, viewer.id), eq(interactions.userB, candidateId)),
				and(eq(interactions.userA, candidateId), eq(interactions.userB, viewer.id)),
			),
		)
		.limit(1);

	const [candidateProfile] = await db
		.select({
			latitude: userProfiles.latitude,
			longitude: userProfiles.longitude,
		})
		.from(userProfiles)
		.where(eq(userProfiles.id, candidateId))
		.limit(1);

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

		await db
			.update(interactions)
			.set({ ...updates, match: matched })
			.where(eq(interactions.id, existingInteraction.id));
	} else {
		await db.insert(interactions).values({
			userA: viewer.id,
			userB: candidateId,
			decA: decisionValue,
			decB: null,
			match: false,
			distanceKm: distance ?? null,
			scoreAToB: null,
			scoreBToA: null,
		});
	}

	await db.update(recommendations).set({ actedOn: true }).where(eq(recommendations.id, pending.id));

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(recommendations)
		.where(and(eq(recommendations.userId, viewer.id), eq(recommendations.actedOn, false)));

	return c.json({ matched, remainingCount: count ?? 0 }, 200);
});

const listMatches = createRoute({
	method: "get",
	path: "/matches",
	tags: ["Recommendations"],
	summary: "Mutual matches for the signed-in user",
	responses: {
		200: { content: { "application/json": { schema: MatchesListSchema } }, description: "Matches" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
	},
});

recommendationsModule.openapi(listMatches, async (c) => {
	const result = await requireViewerProfile(c);

	if ("error" in result) {
		return result.error;
	}

	const { db, viewer } = result;

	const interactionRows = await db
		.select()
		.from(interactions)
		.where(and(eq(interactions.match, true), or(eq(interactions.userA, viewer.id), eq(interactions.userB, viewer.id))));

	const matches = await Promise.all(
		interactionRows.map(async (interaction) => {
			const candidateId = interaction.userA === viewer.id ? interaction.userB : interaction.userA;
			const [candidate] = await db
				.select(publicProfileColumns)
				.from(userProfiles)
				.where(eq(userProfiles.id, candidateId))
				.limit(1);

			if (!candidate) {
				return null;
			}

			const age = profileAge(candidate.birthDate);

			return {
				candidateId,
				displayName: displayNameForCandidate(candidateId),
				photoUrl: resolveProfilePhotoUrl({ ...candidate, id: candidateId }),
				ageLabel: age === undefined ? undefined : ageLabel(age),
				topInterests: interestLabels(candidate as ProfileRow).slice(0, 3),
				matchedAt: interaction.createdAt.toISOString(),
			};
		}),
	);

	const resolved = matches.filter((match): match is NonNullable<typeof match> => match !== null);

	return c.json({ matches: resolved, count: resolved.length }, 200);
});

export default recommendationsModule;

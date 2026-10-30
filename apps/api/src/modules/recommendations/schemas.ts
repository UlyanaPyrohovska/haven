import { z } from "@hono/zod-openapi";
import { MatchReasons } from "@/lib/matching/match-reasons";

const moodSlugValues = ["happy", "calm", "excited", "tired", "low", "stressed"] as const;

export const MoodSlugSchema = z.enum(moodSlugValues).openapi("CandidateMood");

export const ErrorSchema = z
	.object({
		code: z.string(),
		message: z.string(),
	})
	.openapi("Error");

export const RecommendationSummarySchema = z
	.object({
		recommendationId: z.number().int(),
		candidateId: z.number().int(),
		rank: z.number().int(),
		score: z.number(),
		displayName: z.string(),
		photoUrl: z.string().url(),
		ageLabel: z.string().optional(),
		career: z.string().nullable(),
		topInterests: z.array(z.string()),
		sharedInterests: z.array(z.string()),
	})
	.openapi("RecommendationSummary");

export const RecommendationsListSchema = z
	.object({
		recommendations: z.array(RecommendationSummarySchema),
		count: z.number().int(),
		dailyQuestion: z.string(),
		/** True while the viewer hasn't accepted or declined anyone in the current batch. */
		canRegenerate: z.boolean(),
		nextRefreshAt: z.string().datetime().optional(),
	})
	.openapi("RecommendationsList");

export const RecommendationDetailSchema = z
	.object({
		recommendationId: z.number().int(),
		candidateId: z.number().int(),
		rank: z.number().int(),
		score: z.number(),
		displayName: z.string(),
		photoUrl: z.string().url(),
		ageLabel: z.string().optional(),
		career: z.string().nullable(),
		bio: z.string().nullable(),
		interests: z.array(z.string()),
		sharedInterests: z.array(z.string()),
		dailyQuestion: z.string(),
		questionAnswer: z.string().nullable(),
		answerLocked: z.boolean(),
		crossPathsCount: z.number().int().nullable(),
		/** City-level area label of the last crossing; never a user's coordinates. */
		crossPathsPlace: z.string().nullable(),
		crossPathsLastAt: z.string().datetime().nullable(),
		/** City-level area or coarse distance; never coordinates. */
		locationLabel: z.string().optional(),
		actedOn: z.boolean(),
		mood: MoodSlugSchema.nullable(),
		isSynthetic: z.boolean(),
		/** Present only when both sides accepted. */
		match: z
			.object({
				matchedAt: z.string().datetime(),
				compatibility: z.number(),
				reasons: z.array(z.enum(MatchReasons)),
			})
			.nullable(),
	})
	.openapi("RecommendationDetail");

export const DecisionBodySchema = z
	.object({
		decision: z.enum(["accept", "decline"]),
	})
	.openapi("DecisionBody");

export type DecisionBody = z.infer<typeof DecisionBodySchema>;

export const DecisionResponseSchema = z
	.object({
		matched: z.boolean(),
		remainingCount: z.number().int(),
	})
	.openapi("DecisionResponse");

export const MatchSummarySchema = z
	.object({
		candidateId: z.number().int(),
		displayName: z.string(),
		photoUrl: z.string().url(),
		ageLabel: z.string().optional(),
		topInterests: z.array(z.string()),
		/** City-level area or coarse distance; never coordinates. */
		locationLabel: z.string().optional(),
		matchedAt: z.string(),
		isSynthetic: z.boolean(),
		lastMessage: z
			.object({ id: z.number().int(), senderId: z.number().int(), body: z.string(), createdAt: z.string().datetime() })
			.nullable(),
		unreadCount: z.number().int(),
		lastActivityAt: z.string().datetime(),
	})
	.openapi("MatchSummary");

export const MatchesListSchema = z
	.object({
		matches: z.array(MatchSummarySchema),
		count: z.number().int(),
	})
	.openapi("MatchesList");

export const MatchAnswersTodaySchema = z
	.object({
		question: z.string(),
		/** True until the viewer answers today; `answers` is then empty. */
		locked: z.boolean(),
		answers: z.array(
			z.object({
				candidateId: z.number().int(),
				displayName: z.string(),
				photoUrl: z.string().url(),
				answer: z.string(),
			}),
		),
	})
	.openapi("MatchAnswersToday");

export const RegenerateResponseSchema = z
	.object({
		count: z.number().int(),
	})
	.openapi("RegenerateResponse");

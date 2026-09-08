import { z } from "@hono/zod-openapi";

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
	})
	.openapi("RecommendationsList");

export const RecommendationDetailSchema = z
	.object({
		recommendationId: z.number().int(),
		candidateId: z.number().int(),
		rank: z.number().int(),
		score: z.number(),
		displayName: z.string(),
		ageLabel: z.string().optional(),
		career: z.string().nullable(),
		bio: z.string().nullable(),
		interests: z.array(z.string()),
		sharedInterests: z.array(z.string()),
		dailyQuestion: z.string(),
		questionAnswer: z.string(),
		crossPathsCount: z.number().int(),
		distanceKm: z.number().optional(),
		locationLabel: z.string().optional(),
		actedOn: z.boolean(),
	})
	.openapi("RecommendationDetail");

export const DecisionBodySchema = z
	.object({
		decision: z.enum(["accept", "decline"]),
	})
	.openapi("DecisionBody");

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
		ageLabel: z.string().optional(),
		topInterests: z.array(z.string()),
		matchedAt: z.string(),
	})
	.openapi("MatchSummary");

export const MatchesListSchema = z
	.object({
		matches: z.array(MatchSummarySchema),
		count: z.number().int(),
	})
	.openapi("MatchesList");

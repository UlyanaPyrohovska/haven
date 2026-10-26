import { createRoute, z } from "@hono/zod-openapi";
import * as schemas from "./schemas";

export const listRecommendationsRoute = createRoute({
	method: "get",
	path: "/recommendations",
	tags: ["Recommendations"],
	summary: "Pending connection recommendations",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.RecommendationsListSchema } },
			description: "Recommendations",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
	},
});

export const listMatchesRoute = createRoute({
	method: "get",
	path: "/matches",
	tags: ["Recommendations"],
	summary: "Mutual matches for the signed-in user",
	responses: {
		200: { content: { "application/json": { schema: schemas.MatchesListSchema } }, description: "Matches" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	},
});

export const listMatchAnswersTodayRoute = createRoute({
	method: "get",
	path: "/matches/answers/today",
	tags: ["Recommendations"],
	summary: "Today's daily-question answers from the signed-in user's matches in the current mode",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.MatchAnswersTodaySchema } },
			description: "Matches' answers",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	},
});

export const postRegenerateRoute = createRoute({
	method: "post",
	path: "/recommendations/regenerate",
	tags: ["Recommendations"],
	summary: "Replace the pending batch with a fresh one while nothing in it was accepted or declined",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.RegenerateResponseSchema } },
			description: "Batch generated",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
		409: {
			content: { "application/json": { schema: schemas.ErrorSchema } },
			description: "Already acted on the current batch",
		},
	},
});

export const getRecommendationRoute = createRoute({
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
			content: { "application/json": { schema: schemas.RecommendationDetailSchema } },
			description: "Recommendation detail",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const postDecisionRoute = createRoute({
	method: "post",
	path: "/recommendations/{candidateId}/decision",
	tags: ["Recommendations"],
	summary: "Accept or decline a recommendation",
	request: {
		params: z.object({
			candidateId: z.coerce.number().int(),
		}),
		body: { content: { "application/json": { schema: schemas.DecisionBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.DecisionResponseSchema } },
			description: "Decision recorded",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

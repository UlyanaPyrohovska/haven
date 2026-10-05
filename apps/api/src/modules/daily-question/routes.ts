import { createRoute } from "@hono/zod-openapi";
import * as schemas from "./schemas";

export const getTodayDailyQuestionRoute = createRoute({
	method: "get",
	path: "/daily-question/today",
	tags: ["Daily question"],
	summary: "Today's engagement question and your answer",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.DailyQuestionTodayResponseSchema } },
			description: "Today's question; answer is null until you respond",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
	},
});

export const putTodayDailyQuestionRoute = createRoute({
	method: "put",
	path: "/daily-question/today",
	tags: ["Daily question"],
	summary: "Save or update today's answer",
	request: {
		body: { content: { "application/json": { schema: schemas.PutDailyQuestionTodayBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.DailyQuestionTodayResponseSchema } },
			description: "Saved answer",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
	},
});

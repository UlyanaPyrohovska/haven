import { createRoute } from "@hono/zod-openapi";
import * as schemas from "./schemas";

export const getTodayMoodRoute = createRoute({
	method: "get",
	path: "/mood/today",
	tags: ["Mood"],
	summary: "Today's mood check-in",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.MoodTodayResponseSchema } },
			description: "Today's mood, or null when not checked in yet",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
	},
});

export const putTodayMoodRoute = createRoute({
	method: "put",
	path: "/mood/today",
	tags: ["Mood"],
	summary: "Set or update today's mood",
	request: {
		body: { content: { "application/json": { schema: schemas.PutMoodTodayBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.MoodTodayResponseSchema } },
			description: "Saved mood",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
	},
});

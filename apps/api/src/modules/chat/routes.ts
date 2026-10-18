import { createRoute, z } from "@hono/zod-openapi";
import * as schemas from "./schemas";

const params = z.object({ candidateId: z.coerce.number().int() });

const errorResponses = {
	401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not matched" },
} as const;

export const listMessagesRoute = createRoute({
	method: "get",
	path: "/matches/{candidateId}/messages",
	tags: ["Chat"],
	summary: "Messages with a match, newest first",
	request: {
		params,
		query: z.object({ before: z.coerce.number().int().optional() }),
	},
	responses: {
		200: { content: { "application/json": { schema: schemas.MessagesPageSchema } }, description: "Messages" },
		...errorResponses,
	},
});

export const postMessageRoute = createRoute({
	method: "post",
	path: "/matches/{candidateId}/messages",
	tags: ["Chat"],
	summary: "Send a message to a match",
	request: {
		params,
		body: { content: { "application/json": { schema: schemas.SendMessageBodySchema } } },
	},
	responses: {
		200: { content: { "application/json": { schema: schemas.SendMessageResponseSchema } }, description: "Sent" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Invalid message" },
		...errorResponses,
	},
});

export const postReadRoute = createRoute({
	method: "post",
	path: "/matches/{candidateId}/read",
	tags: ["Chat"],
	summary: "Mark the match's messages as read",
	request: { params },
	responses: {
		200: { content: { "application/json": { schema: schemas.MarkReadResponseSchema } }, description: "Marked" },
		...errorResponses,
	},
});

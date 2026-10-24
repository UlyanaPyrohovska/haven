import { createRoute } from "@hono/zod-openapi";
import * as schemas from "./schemas";

const errorResponses = {
	401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "No profile" },
} as const;

export const putPushTokenRoute = createRoute({
	method: "put",
	path: "/push-token",
	tags: ["Notifications"],
	summary: "Register this device for push notifications",
	request: { body: { content: { "application/json": { schema: schemas.PutPushTokenBodySchema } } } },
	responses: {
		200: { content: { "application/json": { schema: schemas.OkSchema } }, description: "Registered" },
		...errorResponses,
	},
});

export const deletePushTokenRoute = createRoute({
	method: "delete",
	path: "/push-token",
	tags: ["Notifications"],
	summary: "Stop push notifications to this device",
	request: { body: { content: { "application/json": { schema: schemas.DeletePushTokenBodySchema } } } },
	responses: {
		200: { content: { "application/json": { schema: schemas.OkSchema } }, description: "Removed" },
		...errorResponses,
	},
});

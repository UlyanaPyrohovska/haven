import { createRoute } from "@hono/zod-openapi";
import * as schemas from "./schemas";

export const getMeRoute = createRoute({
	method: "get",
	path: "/me",
	tags: ["Profile"],
	summary: "Current user's profile",
	description: "Returns the signed-in user's profile, or null when onboarding hasn't been completed.",
	responses: {
		200: { content: { "application/json": { schema: schemas.ProfileResponseSchema } }, description: "Profile" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	},
});

export const patchMeRoute = createRoute({
	method: "patch",
	path: "/me",
	tags: ["Profile"],
	summary: "Create or update the current user's profile",
	description: "Upserts the signed-in user's onboarding answers into `user_profiles`.",
	request: {
		body: { content: { "application/json": { schema: schemas.ProfileUpdateSchema } } },
	},
	responses: {
		200: { content: { "application/json": { schema: schemas.ProfileResponseSchema } }, description: "Updated profile" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	},
});

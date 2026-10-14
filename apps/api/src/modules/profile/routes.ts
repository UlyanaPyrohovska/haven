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

export const searchCustomInterestsRoute = createRoute({
	method: "get",
	path: "/interests/custom",
	tags: ["Profile"],
	summary: "Search user-created interests",
	description: "Returns catalog interests other users created, most used first, optionally filtered by `q`.",
	request: { query: schemas.CustomInterestSearchQuerySchema },
	responses: {
		200: {
			content: { "application/json": { schema: schemas.CustomInterestSearchResponseSchema } },
			description: "Matching interests",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	},
});

export const createCustomInterestRoute = createRoute({
	method: "post",
	path: "/interests/custom",
	tags: ["Profile"],
	summary: "Add a user-created interest to the shared catalog",
	description: "Validates the label and returns the canonical spelling, reusing an existing entry when one matches.",
	request: {
		body: { content: { "application/json": { schema: schemas.CreateCustomInterestBodySchema } } },
	},
	responses: {
		200: { content: { "application/json": { schema: schemas.CustomInterestResponseSchema } }, description: "Interest" },
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Label not allowed" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	},
});

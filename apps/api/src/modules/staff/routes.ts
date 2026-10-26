import { createRoute, z } from "@hono/zod-openapi";
import * as schemas from "./schemas";

export const listUsersRoute = createRoute({
	method: "get",
	path: "/staff/users",
	tags: ["Staff"],
	summary: "List platform users (staff)",
	request: {
		query: schemas.StaffUserListQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.StaffUserListResponseSchema } },
			description: "Paginated user list",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
	},
});

export const getUserRoute = createRoute({
	method: "get",
	path: "/staff/users/{profileId}",
	tags: ["Staff"],
	summary: "Get full user record (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.StaffUserDetailResponseSchema } },
			description: "User detail",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const patchUserRoute = createRoute({
	method: "patch",
	path: "/staff/users/{profileId}",
	tags: ["Staff"],
	summary: "Update user profile and auth fields (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
		body: { content: { "application/json": { schema: schemas.StaffUserUpdateSchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.StaffUserDetailResponseSchema } },
			description: "Updated user",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const deleteUserRoute = createRoute({
	method: "delete",
	path: "/staff/users/{profileId}",
	tags: ["Staff"],
	summary: "Delete user profile and linked auth account (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({ deleted: z.boolean(), profileId: z.number().int() }),
				},
			},
			description: "Deleted",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const simulationTickRoute = createRoute({
	method: "post",
	path: "/staff/simulation/tick",
	tags: ["Staff"],
	summary: "Run one simulation tick: agents reply, act on fresh batches, real users get due drops (staff)",
	request: {
		body: { content: { "application/json": { schema: schemas.SimulationTickBodySchema } }, required: false },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.SimulationTickResponseSchema } },
			description: "Tick stats",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
	},
});

export const interactionGraphRoute = createRoute({
	method: "get",
	path: "/staff/graph",
	tags: ["Staff"],
	summary: "Interaction graph for one pool (staff)",
	request: {
		query: schemas.InteractionGraphQuerySchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.InteractionGraphResponseSchema } },
			description: "Nodes and edges",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
	},
});

export const statsRoute = createRoute({
	method: "get",
	path: "/staff/stats",
	tags: ["Staff"],
	summary: "Dashboard stats (staff)",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.StaffStatsResponseSchema } },
			description: "Totals and daily series",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
	},
});

export const userRecommendationsRoute = createRoute({
	method: "get",
	path: "/staff/users/{profileId}/recommendations",
	tags: ["Staff"],
	summary: "Recommendations shown to a user, with score breakdown (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.StaffRecommendationsResponseSchema } },
			description: "Recommendations with recomputed score components",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const regenerateUserRecommendationsRoute = createRoute({
	method: "post",
	path: "/staff/users/{profileId}/recommendations/regenerate",
	tags: ["Staff"],
	summary: "Replace a user's pending recommendations with a fresh batch (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.StaffRecommendationsResponseSchema } },
			description: "Recommendations after regeneration",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const getMatchingConfigRoute = createRoute({
	method: "get",
	path: "/staff/matching-config",
	tags: ["Staff"],
	summary: "Matching rules in effect (staff)",
	responses: {
		200: {
			content: { "application/json": { schema: schemas.MatchingConfigResponseSchema } },
			description: "Current config and code defaults",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
	},
});

export const putMatchingConfigRoute = createRoute({
	method: "put",
	path: "/staff/matching-config",
	tags: ["Staff"],
	summary: "Save matching rules (staff)",
	request: {
		body: { content: { "application/json": { schema: schemas.MatchingConfigSchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.MatchingConfigResponseSchema } },
			description: "Saved config",
		},
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
	},
});

export const getWalkersRoute = createRoute({
	method: "get",
	path: "/staff/users/{profileId}/walkers",
	tags: ["Staff"],
	summary: "Location walkers around a user, with crossings (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.WalkersOverviewSchema } },
			description: "Walkers overview",
		},
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Invalid walk" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const assignWalkersRoute = createRoute({
	method: "post",
	path: "/staff/users/{profileId}/walkers",
	tags: ["Staff"],
	summary: "Assign synthetic profiles to walk around a user (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
		body: { content: { "application/json": { schema: schemas.AssignWalkersBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.WalkersOverviewSchema } },
			description: "Walkers after assigning",
		},
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Invalid walk" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const stepWalkersRoute = createRoute({
	method: "post",
	path: "/staff/users/{profileId}/walkers/step",
	tags: ["Staff"],
	summary: "Move this user's walkers one step now (staff)",
	request: {
		params: schemas.StaffUserIdParamSchema,
		body: { content: { "application/json": { schema: schemas.StepWalkersBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.WalkersOverviewSchema } },
			description: "Walkers after the step",
		},
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Invalid walk" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const updateWalkerRoute = createRoute({
	method: "patch",
	path: "/staff/walkers/{walkerId}",
	tags: ["Staff"],
	summary: "Pause, resume or tune a walker (staff)",
	request: {
		params: schemas.StaffWalkerIdParamSchema,
		body: { content: { "application/json": { schema: schemas.UpdateWalkerBodySchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.WalkersOverviewSchema } },
			description: "Walkers of the walker's target",
		},
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Invalid walk" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

export const deleteWalkerRoute = createRoute({
	method: "delete",
	path: "/staff/walkers/{walkerId}",
	tags: ["Staff"],
	summary: "Stop a walker and restore its seeded location (staff)",
	request: {
		params: schemas.StaffWalkerIdParamSchema,
	},
	responses: {
		200: {
			content: { "application/json": { schema: schemas.WalkersOverviewSchema } },
			description: "Walkers of the walker's former target",
		},
		400: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Invalid walk" },
		401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
		403: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
	},
});

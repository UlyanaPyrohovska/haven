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

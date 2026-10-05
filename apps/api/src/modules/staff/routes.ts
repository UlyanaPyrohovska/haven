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

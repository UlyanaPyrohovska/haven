import { createRoute, z } from "@hono/zod-openapi";
import * as schemas from "./schemas";

const params = z.object({ candidateId: z.coerce.number().int() });

const responses = {
	200: { content: { "application/json": { schema: schemas.SafetyResponseSchema } }, description: "User blocked" },
	401: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Unauthenticated" },
	404: { content: { "application/json": { schema: schemas.ErrorSchema } }, description: "Not found" },
} as const;

export const postBlockRoute = createRoute({
	method: "post",
	path: "/users/{candidateId}/block",
	tags: ["Safety"],
	summary: "Block a user",
	description: "Removes the pair from each other's recommendations and matches for good.",
	request: { params },
	responses,
});

export const postReportRoute = createRoute({
	method: "post",
	path: "/users/{candidateId}/report",
	tags: ["Safety"],
	summary: "Report a user to staff",
	description: "Stores the report for staff review and blocks the user.",
	request: {
		params,
		body: { content: { "application/json": { schema: schemas.ReportBodySchema } } },
	},
	responses,
});

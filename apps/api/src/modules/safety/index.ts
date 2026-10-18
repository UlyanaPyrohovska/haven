import { createOpenAPIApp } from "@/lib/openapi";
import { closeConversation } from "@/modules/chat/service";
import { findInteractionBetween } from "@/modules/recommendations/repository";
import { requireViewer } from "@/modules/recommendations/service";
import * as routes from "./routes";
import * as service from "./service";

export const safety = createOpenAPIApp();

// POST /users/{candidateId}/block
safety.openapi(routes.postBlockRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	const result = await service.block(ctx, candidateId);
	await closeConversation(c.env, await findInteractionBetween(ctx.db, ctx.viewer.id, candidateId));
	return c.json(result, 200);
});

// POST /users/{candidateId}/report
safety.openapi(routes.postReportRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	const result = await service.report(ctx, candidateId, c.req.valid("json"));
	await closeConversation(c.env, await findInteractionBetween(ctx.db, ctx.viewer.id, candidateId));
	return c.json(result, 200);
});

export default safety;

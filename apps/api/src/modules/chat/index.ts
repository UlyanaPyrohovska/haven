import { createOpenAPIApp } from "@/lib/openapi";
import { requireViewer } from "@/modules/recommendations/service";
import * as routes from "./routes";
import * as service from "./service";

export const chat = createOpenAPIApp();

// GET /matches/{candidateId}/messages
chat.openapi(routes.listMessagesRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	const { before } = c.req.valid("query");
	return c.json(await service.getMessages(ctx, candidateId, before), 200);
});

// POST /matches/{candidateId}/messages
chat.openapi(routes.postMessageRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	return c.json(
		await service.postMessage(ctx, c.env, candidateId, c.req.valid("json").body, (task) =>
			c.executionCtx.waitUntil(task),
		),
		200,
	);
});

// POST /matches/{candidateId}/read
chat.openapi(routes.postReadRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	return c.json(await service.markRead(ctx, candidateId), 200);
});

// GET /matches/{candidateId}/ws — websocket upgrade, not part of the OpenAPI doc
chat.get("/matches/:candidateId/ws", async (c) => {
	const ctx = await requireViewer(c);
	return service.connectSocket(ctx, c.env, Number(c.req.param("candidateId")), c.req.raw);
});

export default chat;

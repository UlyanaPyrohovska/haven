import { createOpenAPIApp } from "@/lib/openapi";
import { requireViewer } from "@/modules/recommendations/service";
import * as routes from "./routes";
import * as service from "./service";

export const safety = createOpenAPIApp();

// POST /users/{candidateId}/block
safety.openapi(routes.postBlockRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	return c.json(await service.block(ctx, candidateId), 200);
});

// POST /users/{candidateId}/report
safety.openapi(routes.postReportRoute, async (c) => {
	const ctx = await requireViewer(c);
	const { candidateId } = c.req.valid("param");
	return c.json(await service.report(ctx, candidateId, c.req.valid("json")), 200);
});

export default safety;

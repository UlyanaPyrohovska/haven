import { createOpenAPIApp } from "@/lib/openapi";
import * as routes from "./routes";
import * as service from "./service";

export const recommendationsModule = createOpenAPIApp();

// GET /recommendations
recommendationsModule.openapi(routes.listRecommendationsRoute, async (c) => {
	const ctx = await service.requireViewer(c);
	return c.json(await service.getRecommendations(ctx), 200);
});

// POST /recommendations/regenerate
recommendationsModule.openapi(routes.postRegenerateRoute, async (c) => {
	const ctx = await service.requireViewer(c);
	return c.json(await service.regenerate(ctx), 200);
});

// GET /matches
recommendationsModule.openapi(routes.listMatchesRoute, async (c) => {
	const ctx = await service.requireViewer(c);
	return c.json(await service.getMatches(ctx), 200);
});

// GET /recommendations/{candidateId}
recommendationsModule.openapi(routes.getRecommendationRoute, async (c) => {
	const ctx = await service.requireViewer(c);
	const { candidateId } = c.req.valid("param");
	return c.json(await service.getRecommendationDetail(ctx, candidateId), 200);
});

// POST /recommendations/{candidateId}/decision
recommendationsModule.openapi(routes.postDecisionRoute, async (c) => {
	const ctx = await service.requireViewer(c);
	const { candidateId } = c.req.valid("param");
	const body = c.req.valid("json");
	return c.json(await service.postDecision(ctx, candidateId, body), 200);
});

export default recommendationsModule;

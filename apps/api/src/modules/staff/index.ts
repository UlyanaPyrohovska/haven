import { createOpenAPIApp } from "@/lib/openapi";
import * as routes from "./routes";
import * as service from "./service";

export const staff = createOpenAPIApp();

staff.openapi(routes.listUsersRoute, async (c) => {
	const query = c.req.valid("query");
	return c.json(await service.listUsers(c, query), 200);
});

staff.openapi(routes.getUserRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.getUser(c, profileId), 200);
});

staff.openapi(routes.patchUserRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	const body = c.req.valid("json");
	return c.json(await service.updateUser(c, profileId, body), 200);
});

staff.openapi(routes.deleteUserRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.deleteUser(c, profileId), 200);
});

staff.openapi(routes.simulationTickRoute, async (c) => {
	const body = c.req.valid("json") ?? {};
	return c.json(await service.simulationTick(c, body.limit), 200);
});

staff.openapi(routes.interactionGraphRoute, async (c) => {
	const query = c.req.valid("query");
	return c.json(await service.interactionGraph(c, query), 200);
});

staff.openapi(routes.statsRoute, async (c) => {
	return c.json(await service.stats(c), 200);
});

staff.openapi(routes.userRecommendationsRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.userRecommendations(c, profileId), 200);
});

staff.openapi(routes.regenerateUserRecommendationsRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.regenerateUserRecommendations(c, profileId), 200);
});

staff.openapi(routes.getMatchingConfigRoute, async (c) => {
	return c.json(await service.getMatchingConfig(c), 200);
});

staff.openapi(routes.putMatchingConfigRoute, async (c) => {
	const body = c.req.valid("json");
	return c.json(await service.updateMatchingConfig(c, body), 200);
});

staff.openapi(routes.getWalkersRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.getWalkers(c, profileId), 200);
});

staff.openapi(routes.assignWalkersRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.assignWalkers(c, profileId, c.req.valid("json")), 200);
});

staff.openapi(routes.stepWalkersRoute, async (c) => {
	const { profileId } = c.req.valid("param");
	return c.json(await service.stepWalkers(c, profileId, c.req.valid("json")), 200);
});

staff.openapi(routes.updateWalkerRoute, async (c) => {
	const { walkerId } = c.req.valid("param");
	return c.json(await service.updateWalker(c, walkerId, c.req.valid("json")), 200);
});

staff.openapi(routes.deleteWalkerRoute, async (c) => {
	const { walkerId } = c.req.valid("param");
	return c.json(await service.deleteWalker(c, walkerId), 200);
});

export default staff;

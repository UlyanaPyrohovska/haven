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

export default staff;

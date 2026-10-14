import { createOpenAPIApp } from "@/lib/openapi";
import * as routes from "./routes";
import * as service from "./service";

export const profile = createOpenAPIApp();

// GET /me
profile.openapi(routes.getMeRoute, async (c) => c.json(await service.getProfile(c), 200));

// PATCH /me
profile.openapi(routes.patchMeRoute, async (c) => {
	const updates = c.req.valid("json");
	return c.json(await service.patchProfile(c, updates), 200);
});

// GET /interests/custom
profile.openapi(routes.searchCustomInterestsRoute, async (c) => {
	const { q } = c.req.valid("query");
	return c.json(await service.searchCustomInterests(c, q), 200);
});

// POST /interests/custom
profile.openapi(routes.createCustomInterestRoute, async (c) => {
	const { label } = c.req.valid("json");
	return c.json(await service.createCustomInterest(c, label), 200);
});

export default profile;

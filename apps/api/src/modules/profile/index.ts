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

export default profile;

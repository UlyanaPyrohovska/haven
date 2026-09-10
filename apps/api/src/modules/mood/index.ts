import { createOpenAPIApp } from "@/lib/openapi";
import * as routes from "./routes";
import * as service from "./service";

export const mood = createOpenAPIApp();

// GET /mood/today
mood.openapi(routes.getTodayMoodRoute, async (c) => c.json(await service.getTodayMood(c), 200));

// PUT /mood/today
mood.openapi(routes.putTodayMoodRoute, async (c) => {
	const body = c.req.valid("json");
	return c.json(await service.putTodayMood(c, body), 200);
});

export default mood;

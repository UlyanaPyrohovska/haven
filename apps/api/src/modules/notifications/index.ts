import { createOpenAPIApp } from "@/lib/openapi";
import { requireViewer } from "@/modules/recommendations/service";
import * as routes from "./routes";
import * as service from "./service";

export const notifications = createOpenAPIApp();

// PUT /push-token
notifications.openapi(routes.putPushTokenRoute, async (c) => {
	const ctx = await requireViewer(c);
	return c.json(await service.registerToken(ctx, c.req.valid("json")), 200);
});

// DELETE /push-token
notifications.openapi(routes.deletePushTokenRoute, async (c) => {
	const ctx = await requireViewer(c);
	return c.json(await service.unregisterToken(ctx, c.req.valid("json").token), 200);
});

export default notifications;

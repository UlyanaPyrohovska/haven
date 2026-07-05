import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createAuth } from "@/lib/auth";
import { validationErrorHook } from "./validation";

const OPEN_API_CONFIG = {
	openapi: "3.0.4",
	info: { title: "Haven API", version: "1.0.0" },
	servers: [{ url: "http://127.0.0.1:8787", description: "Local development" }],
};

export function createOpenAPIApp() {
	return new OpenAPIHono<{ Bindings: CloudflareBindings }>({
		defaultHook: validationErrorHook,
	});
}

export type App = ReturnType<typeof createOpenAPIApp>;

export function withOpenApiDoc(app: App) {
	app.get("/openapi.json", async (c) => {
		const authDoc = await createAuth(c.env).api.generateOpenAPISchema();
		const apiDoc = app.getOpenAPIDocument(OPEN_API_CONFIG);
		return c.json({
			...apiDoc,
			components: {
				...apiDoc.components,
				...authDoc.components,
			},
		});
	});
	app.get("/docs", Scalar({ url: "/openapi.json" }));

	return app;
}

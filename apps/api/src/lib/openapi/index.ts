import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { createAuth } from "@/lib/auth";
import { errorHandler } from "@/lib/http/errors";
import { validationErrorHook } from "./validation";

const PRODUCTION_URL = "https://haven-api.haven-app.workers.dev";

const OPEN_API_INFO = {
	openapi: "3.0.4" as const,
	info: { title: "Haven API", version: "1.0.0" },
};

export function createOpenAPIApp() {
	const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>({
		defaultHook: validationErrorHook,
	});

	app.use("*", async (c, next) => {
		try {
			await next();
		} catch (err) {
			return errorHandler(err, c);
		}
	});

	return app;
}

export type App = ReturnType<typeof createOpenAPIApp>;

export function withOpenApiDoc(app: App) {
	app.get("/openapi.json", async (c) => {
		const authDoc = await createAuth(c.env).api.generateOpenAPISchema();
		const requestOrigin = new URL(c.req.url).origin;
		const apiDoc = app.getOpenAPIDocument({
			...OPEN_API_INFO,
			servers: [
				{ url: requestOrigin, description: "Current host" },
				{ url: PRODUCTION_URL, description: "Production" },
				{ url: "http://localhost:8787", description: "Local development" },
			],
		});

		const authPaths = Object.fromEntries(
			Object.entries(authDoc.paths).map(([path, operation]) => [`/auth${path}`, operation]),
		);

		return c.json({
			...apiDoc,
			paths: {
				...apiDoc.paths,
				...authPaths,
			},
			components: {
				...apiDoc.components,
				...authDoc.components,
				schemas: {
					...apiDoc.components?.schemas,
					...authDoc.components?.schemas,
				},
				securitySchemes: {
					...apiDoc.components?.securitySchemes,
					...authDoc.components?.securitySchemes,
				},
			},
			tags: [...(apiDoc.tags ?? []), ...(authDoc.tags ?? [])],
		});
	});
	app.get("/docs", Scalar({ url: "/openapi.json" }));

	return app;
}

import { notFoundHandler } from "./lib/http/errors";
import { createOpenAPIApp, withOpenApiDoc } from "./lib/openapi";
import auth from "./modules/auth";
import profile from "./modules/profile";
import recommendations from "./modules/recommendations";

export const createApp = () => {
	const app = withOpenApiDoc(createOpenAPIApp());

	app.route("/auth", auth);
	app.route("/", profile);
	app.route("/", recommendations);

	app.notFound(notFoundHandler);

	return app;
};

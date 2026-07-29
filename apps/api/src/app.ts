import { createOpenAPIApp, withOpenApiDoc } from "./lib/openapi";
import auth from "./modules/auth";

export const createApp = () => {
	const app = withOpenApiDoc(createOpenAPIApp());

	app.route("/auth", auth);

	return app;
};

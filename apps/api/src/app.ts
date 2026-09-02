import { createOpenAPIApp, withOpenApiDoc } from "./lib/openapi";
import auth from "./modules/auth";
import profile from "./modules/profile";

export const createApp = () => {
	const app = withOpenApiDoc(createOpenAPIApp());

	app.route("/auth", auth);
	app.route("/", profile);

	return app;
};

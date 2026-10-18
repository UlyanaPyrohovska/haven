import { notFoundHandler } from "./lib/http/errors";
import { createOpenAPIApp, withOpenApiDoc } from "./lib/openapi";
import auth from "./modules/auth";
import dailyQuestion from "./modules/daily-question";
import legal from "./modules/legal";
import mood from "./modules/mood";
import profile from "./modules/profile";
import recommendations from "./modules/recommendations";
import safety from "./modules/safety";
import staff from "./modules/staff";

export const createApp = () => {
	const app = withOpenApiDoc(createOpenAPIApp());

	app.route("/auth", auth);
	app.route("/", staff);
	app.route("/", profile);
	app.route("/", mood);
	app.route("/", dailyQuestion);
	app.route("/", recommendations);
	app.route("/", safety);
	app.route("/", legal);

	app.notFound(notFoundHandler);

	return app;
};

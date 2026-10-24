import { cors } from "hono/cors";
import { BACKOFFICE_ORIGIN } from "./lib/auth";
import { notFoundHandler } from "./lib/http/errors";
import { createOpenAPIApp, withOpenApiDoc } from "./lib/openapi";
import auth from "./modules/auth";
import chat from "./modules/chat";
import dailyQuestion from "./modules/daily-question";
import legal from "./modules/legal";
import links from "./modules/links";
import mood from "./modules/mood";
import profile from "./modules/profile";
import recommendations from "./modules/recommendations";
import safety from "./modules/safety";
import staff from "./modules/staff";

export const createApp = () => {
	const app = withOpenApiDoc(createOpenAPIApp());

	// The deployed backoffice is a separate origin; it sends the session cookie (same site, SameSite=Lax).
	app.use("*", cors({ origin: BACKOFFICE_ORIGIN, credentials: true }));

	app.route("/auth", auth);
	app.route("/", staff);
	app.route("/", profile);
	app.route("/", mood);
	app.route("/", dailyQuestion);
	app.route("/", recommendations);
	app.route("/", safety);
	app.route("/", chat);
	app.route("/", legal);
	app.route("/", links);

	app.notFound(notFoundHandler);

	return app;
};

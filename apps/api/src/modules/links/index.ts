import { Hono } from "hono";

/**
 * Email links must be https, so they land here and bounce into the app, which redeems the token
 * itself. Only fixed haven:// targets, so this is not an open redirect.
 */
const links = new Hono();

links.get("/links/verify-email", (c) => {
	const token = c.req.query("token");
	if (!token) {
		return c.text("Missing token.", 400);
	}
	return c.redirect(`haven://verify-email?token=${encodeURIComponent(token)}`);
});

export default links;

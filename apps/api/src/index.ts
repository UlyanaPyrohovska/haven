import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb } from "./db";

type Bindings = {
	DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => c.text("Hello Hono!"));

app.get("/healthz", (c) => c.json({ status: "ok", service: "haven-api" }));

app.get("/healthz/db", async (c) => {
	console.log(c.env.DATABASE_URL);

	const db = createDb(c.env.DATABASE_URL);
	const result = await db.execute(sql`SELECT 1 AS ok`);
	return c.json({ ok: result.rows[0]?.ok === 1 });
});

export default app;

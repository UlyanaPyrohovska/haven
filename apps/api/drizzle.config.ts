import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// ENV_FILE picks the target database (e.g. .env.prod); otherwise drizzle-kit's default .env applies.
if (process.env.ENV_FILE) config({ path: process.env.ENV_FILE, override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("Missing env variable: DATABASE_URL");
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
	verbose: true,
	strict: true,
});

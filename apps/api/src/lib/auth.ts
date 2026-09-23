import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { getDb } from "@/db";
import * as schema from "@/modules/auth/auth-schema";

export const createAuth = (bindings: CloudflareBindings) => {
	const db = getDb(bindings.DATABASE_URL);
	return betterAuth({
		database: drizzleAdapter(db, { provider: "pg", schema }),
		appName: "Haven API",
		basePath: "/auth",
		baseURL: bindings.BETTER_AUTH_URL,
		secret: bindings.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true,
		},
		// Prefix match: haven:// (app scheme), exp:// (Expo Go).
		trustedOrigins: ["haven://", "exp://"],
		plugins: [openAPI(), expo()],
	});
};

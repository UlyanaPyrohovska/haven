import { createRoute, z } from "@hono/zod-openapi";
import { eq, getTableColumns } from "drizzle-orm";
import { getDb } from "@/db";
import { userProfiles } from "@/db/schema";
import { createOpenAPIApp } from "@/lib/openapi";
import { getSessionUserId, UNAUTHORIZED } from "@/lib/session";
import { ErrorSchema, ProfileUpdateSchema } from "./profile-schema";

/** `email` and `passwordHash` only exist for synthetic seed rows and must never be returned. */
const { email: _email, passwordHash: _passwordHash, ...publicProfileColumns } = getTableColumns(userProfiles);

const ProfileResponseSchema = z
	.object({
		profile: z.record(z.string(), z.unknown()).nullable(),
	})
	.openapi("ProfileResponse");

export const profile = createOpenAPIApp();

const getMe = createRoute({
	method: "get",
	path: "/me",
	tags: ["Profile"],
	summary: "Current user's profile",
	description: "Returns the signed-in user's profile, or null when onboarding hasn't been completed.",
	responses: {
		200: { content: { "application/json": { schema: ProfileResponseSchema } }, description: "Profile" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
	},
});

profile.openapi(getMe, async (c) => {
	const userId = await getSessionUserId(c);

	if (!userId) {
		return c.json(UNAUTHORIZED, 401);
	}

	const db = getDb(c.env.DATABASE_URL);
	const [row] = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);

	return c.json({ profile: row ?? null }, 200);
});

const patchMe = createRoute({
	method: "patch",
	path: "/me",
	tags: ["Profile"],
	summary: "Create or update the current user's profile",
	description: "Upserts the signed-in user's onboarding answers into `user_profiles`.",
	request: {
		body: { content: { "application/json": { schema: ProfileUpdateSchema } } },
	},
	responses: {
		200: { content: { "application/json": { schema: ProfileResponseSchema } }, description: "Updated profile" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthenticated" },
	},
});

profile.openapi(patchMe, async (c) => {
	const userId = await getSessionUserId(c);

	if (!userId) {
		return c.json(UNAUTHORIZED, 401);
	}

	const updates = c.req.valid("json");
	const db = getDb(c.env.DATABASE_URL);

	const [existing] = await db
		.select({ id: userProfiles.id })
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);

	const [row] = existing
		? await db
				.update(userProfiles)
				.set({ ...updates, updatedAt: new Date() })
				.where(eq(userProfiles.id, existing.id))
				.returning(publicProfileColumns)
		: await db
				.insert(userProfiles)
				.values({ ...updates, userId, isSynthetic: false })
				.returning(publicProfileColumns);

	return c.json({ profile: row ?? null }, 200);
});

export default profile;

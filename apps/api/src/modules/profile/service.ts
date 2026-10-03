import type { Context } from "hono";
import { getDb } from "@/db";
import { errors } from "@/lib/errors";
import { getSessionUserId } from "@/lib/session";
import * as repository from "./repository";
import type { ProfileUpdate } from "./schemas";

export async function requireUserId(c: Context<{ Bindings: CloudflareBindings }>) {
	const userId = await getSessionUserId(c);

	if (!userId) {
		throw errors.unauthorized;
	}

	return userId;
}

export async function getProfile(c: Context<{ Bindings: CloudflareBindings }>) {
	const userId = await requireUserId(c);
	const db = getDb(c.env.DATABASE_URL);
	const profile = await repository.findProfileByUserId(db, userId);

	return { profile };
}

function normalizeProfileUpdate(updates: ProfileUpdate): ProfileUpdate {
	if (updates.locationHidden !== true) {
		return updates;
	}

	return {
		...updates,
		locationHidden: true,
		displayLocation: null,
		latitude: null,
		longitude: null,
	};
}

export async function patchProfile(c: Context<{ Bindings: CloudflareBindings }>, updates: ProfileUpdate) {
	const userId = await requireUserId(c);
	const db = getDb(c.env.DATABASE_URL);
	const profileId = await repository.findProfileIdByUserId(db, userId);
	const payload = normalizeProfileUpdate(updates);

	const profile = profileId
		? await repository.updateProfileById(db, profileId, payload)
		: await repository.insertProfile(db, userId, payload);

	return { profile };
}

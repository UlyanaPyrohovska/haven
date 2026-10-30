import type { Context } from "hono";
import { getDb } from "@/db";
import { moodCode, moodSlug, utcToday } from "@/lib/daily/mood";
import { errors } from "@/lib/http/service-errors";
import * as profileRepository from "@/modules/profile/repository";
import { requireUserId } from "@/modules/profile/service";
import * as repository from "./repository";
import type { PutMoodTodayBody } from "./schemas";

async function requireProfileId(c: Context<{ Bindings: CloudflareBindings }>) {
	const userId = await requireUserId(c);
	const db = getDb(c.env.DATABASE_URL);
	const profileId = await profileRepository.findProfileIdByUserId(db, userId);

	if (!profileId) {
		throw errors.no_profile;
	}

	return { db, profileId };
}

export async function getTodayMood(c: Context<{ Bindings: CloudflareBindings }>) {
	const { db, profileId } = await requireProfileId(c);
	const row = await repository.findCheckinForDate(db, profileId, utcToday());

	return { mood: row ? moodSlug(row.mood) : null };
}

export async function putTodayMood(c: Context<{ Bindings: CloudflareBindings }>, body: PutMoodTodayBody) {
	const { db, profileId } = await requireProfileId(c);
	await repository.upsertCheckinForDate(db, profileId, utcToday(), moodCode(body.mood));

	return { mood: body.mood };
}

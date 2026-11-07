import type { Context } from "hono";
import { moodCode, moodSlug, utcToday } from "@/lib/daily/mood";
import { requireProfileId } from "@/modules/profile/service";
import * as repository from "./repository";
import type { PutMoodTodayBody } from "./schemas";

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

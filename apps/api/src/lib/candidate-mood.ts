import type { Db } from "@/db";
import { type MoodSlug, MoodSlugs, moodSlug, utcToday } from "@/lib/mood";
import * as moodRepository from "@/modules/mood/repository";

/** Deterministic daily mood for synthetic profiles (no DB row needed). */
export function syntheticMoodForProfile(profileId: number, date = utcToday()): MoodSlug {
	let hash = profileId;

	for (const char of date) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}

	return MoodSlugs[hash % MoodSlugs.length];
}

export async function resolveCandidateMood(db: Db, profileId: number, isSynthetic: boolean): Promise<MoodSlug | null> {
	if (isSynthetic) {
		return syntheticMoodForProfile(profileId);
	}

	const row = await moodRepository.findCheckinForDate(db, profileId, utcToday());
	return row ? moodSlug(row.mood) : null;
}

import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { moodCheckins } from "@/db/schema";
import type { MoodValue } from "@/lib/mood";

export async function findCheckinForDate(db: Db, profileId: number, checkinDate: string) {
	const [row] = await db
		.select({ mood: moodCheckins.mood })
		.from(moodCheckins)
		.where(and(eq(moodCheckins.userProfileId, profileId), eq(moodCheckins.checkinDate, checkinDate)))
		.limit(1);

	return row ?? null;
}

export async function upsertCheckinForDate(db: Db, profileId: number, checkinDate: string, mood: MoodValue) {
	const existing = await findCheckinForDate(db, profileId, checkinDate);

	if (existing) {
		await db
			.update(moodCheckins)
			.set({ mood, updatedAt: new Date() })
			.where(and(eq(moodCheckins.userProfileId, profileId), eq(moodCheckins.checkinDate, checkinDate)));

		return;
	}

	await db.insert(moodCheckins).values({
		userProfileId: profileId,
		mood,
		checkinDate,
	});
}

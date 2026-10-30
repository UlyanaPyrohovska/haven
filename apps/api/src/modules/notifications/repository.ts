import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { pushTokens } from "@/db/schema";
import type { PushPlatform } from "@/lib/messaging/push";

/** A device signing into another account moves its token there. */
export async function upsertToken(db: Db, profileId: number, token: string, platform: PushPlatform) {
	await db
		.insert(pushTokens)
		.values({ userProfileId: profileId, token, platform })
		.onConflictDoUpdate({
			target: pushTokens.token,
			set: { userProfileId: profileId, platform, updatedAt: sql`now()` },
		});
}

export async function deleteToken(db: Db, profileId: number, token: string) {
	await db.delete(pushTokens).where(and(eq(pushTokens.userProfileId, profileId), eq(pushTokens.token, token)));
}

export function listTokens(db: Db, profileId: number) {
	return db
		.select({ token: pushTokens.token, platform: pushTokens.platform })
		.from(pushTokens)
		.where(eq(pushTokens.userProfileId, profileId));
}

export async function deleteTokens(db: Db, tokens: string[]) {
	await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
}

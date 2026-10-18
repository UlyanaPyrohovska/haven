import { desc, eq, getTableColumns, inArray, like, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { customInterests, user, userProfiles } from "@/db/schema";
import { customInterestKey } from "@/lib/custom-interests";
import type { ProfileUpdate } from "./schemas";

const { email: _email, passwordHash: _passwordHash, ...publicProfileColumns } = getTableColumns(userProfiles);

export { publicProfileColumns };

export async function findProfileByUserId(db: Db, userId: string) {
	const [row] = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);

	return row ?? null;
}

export async function findAuthUserName(db: Db, userId: string) {
	const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);

	return row?.name ?? null;
}

export async function findProfileIdByUserId(db: Db, userId: string) {
	const [existing] = await db
		.select({ id: userProfiles.id })
		.from(userProfiles)
		.where(eq(userProfiles.userId, userId))
		.limit(1);

	return existing?.id ?? null;
}

export async function updateProfileById(db: Db, profileId: number, updates: ProfileUpdate) {
	const [row] = await db
		.update(userProfiles)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(userProfiles.id, profileId))
		.returning(publicProfileColumns);

	return row ?? null;
}

export async function insertProfile(db: Db, userId: string, updates: ProfileUpdate) {
	const [row] = await db
		.insert(userProfiles)
		.values({ ...updates, userId, isSynthetic: false })
		.returning(publicProfileColumns);

	return row ?? null;
}

/**
 * Deletes the profile (cascading to embeddings, interactions, mood, answers, recommendations and reports
 * against it) and the auth user (cascading to sessions and accounts; the photo lives on `user.image`).
 */
export async function deleteAccount(db: Db, userId: string) {
	await db.batch([
		db.delete(userProfiles).where(eq(userProfiles.userId, userId)),
		db.delete(user).where(eq(user.id, userId)),
	]);
}

/** Adds new labels to the shared catalog and returns the canonical spelling for each one, in order. */
export async function upsertCustomInterests(db: Db, labels: readonly string[]) {
	if (labels.length === 0) {
		return [];
	}

	const rows = labels.map((label) => ({ label, key: customInterestKey(label) }));

	await db.insert(customInterests).values(rows).onConflictDoNothing({ target: customInterests.key });

	const stored = await db
		.select({ label: customInterests.label, key: customInterests.key })
		.from(customInterests)
		.where(
			inArray(
				customInterests.key,
				rows.map((row) => row.key),
			),
		);
	const labelByKey = new Map(stored.map((row) => [row.key, row.label]));

	return rows.map((row) => labelByKey.get(row.key) ?? row.label);
}

// shortcut: usage is counted per row with a scan of user_profiles, add a usage_count column if the catalog grows large.
const customInterestUsage = sql<number>`(select count(*) from ${userProfiles} where ${customInterests.label} = any(${userProfiles.customInterests}))`;

export async function searchCustomInterests(db: Db, query: string, limit = 20) {
	const key = customInterestKey(query).replace(/[\\%_]/g, "\\$&");
	const rows = await db
		.select({ label: customInterests.label })
		.from(customInterests)
		.where(key ? like(customInterests.key, `%${key}%`) : undefined)
		.orderBy(desc(customInterestUsage), customInterests.label)
		.limit(limit);

	return rows.map((row) => row.label);
}

import { eq, getTableColumns } from "drizzle-orm";
import type { Db } from "@/db";
import { userProfiles } from "@/db/schema";
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

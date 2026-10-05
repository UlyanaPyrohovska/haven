import { count, desc, eq, getTableColumns, ilike, or } from "drizzle-orm";
import type { Db } from "@/db";
import { user, userProfiles } from "@/db/schema";
import type { ProfileUpdate } from "@/modules/profile/schemas";
import type { StaffUserListQuery } from "./schemas";

const profileColumns = getTableColumns(userProfiles);

export async function countProfiles(db: Db, query: StaffUserListQuery) {
	const where = buildSearchWhere(query.q);

	const base = db.select({ total: count() }).from(userProfiles);
	const [row] = where ? await base.where(where) : await base;

	return row?.total ?? 0;
}

export async function listProfiles(db: Db, query: StaffUserListQuery) {
	const where = buildSearchWhere(query.q);

	const base = db
		.select({
			profileId: userProfiles.id,
			userId: userProfiles.userId,
			displayName: userProfiles.displayName,
			email: userProfiles.email,
			isSynthetic: userProfiles.isSynthetic,
			lookingFor: userProfiles.lookingFor,
			createdAt: userProfiles.createdAt,
		})
		.from(userProfiles)
		.orderBy(desc(userProfiles.id))
		.limit(query.limit)
		.offset(query.offset);

	return where ? base.where(where) : base;
}

export async function findProfileById(db: Db, profileId: number) {
	const [row] = await db.select(profileColumns).from(userProfiles).where(eq(userProfiles.id, profileId)).limit(1);

	return row ?? null;
}

export async function findAuthUserById(db: Db, authUserId: string) {
	const [row] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			role: user.role,
			banned: user.banned,
			banReason: user.banReason,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})
		.from(user)
		.where(eq(user.id, authUserId))
		.limit(1);

	return row ?? null;
}

export async function updateProfileById(db: Db, profileId: number, updates: ProfileUpdate) {
	const [row] = await db
		.update(userProfiles)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(userProfiles.id, profileId))
		.returning(profileColumns);

	return row ?? null;
}

export async function updateAuthUserById(db: Db, authUserId: string, updates: { name?: string; email?: string }) {
	const [row] = await db
		.update(user)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(user.id, authUserId))
		.returning({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			role: user.role,
			banned: user.banned,
			banReason: user.banReason,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		});

	return row ?? null;
}

export async function deleteProfileById(db: Db, profileId: number) {
	const [row] = await db.delete(userProfiles).where(eq(userProfiles.id, profileId)).returning({ id: userProfiles.id });

	return row ?? null;
}

export async function deleteAuthUserById(db: Db, authUserId: string) {
	const [row] = await db.delete(user).where(eq(user.id, authUserId)).returning({ id: user.id });

	return row ?? null;
}

function buildSearchWhere(q?: string) {
	if (!q?.trim()) {
		return undefined;
	}

	const term = `%${q.trim()}%`;
	const profileId = Number.parseInt(q, 10);

	const clauses = [
		ilike(userProfiles.displayName, term),
		ilike(userProfiles.email, term),
		ilike(userProfiles.userId, term),
	];

	if (!Number.isNaN(profileId)) {
		clauses.push(eq(userProfiles.id, profileId));
	}

	return or(...clauses);
}

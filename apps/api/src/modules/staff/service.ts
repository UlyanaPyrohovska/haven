import type { Context } from "hono";
import { getDb } from "@/db";
import { errors } from "@/lib/errors";
import { requireStaffAdmin } from "@/lib/session";
import type { ProfileUpdate } from "@/modules/profile/schemas";
import * as repository from "./repository";
import type { StaffUserListQuery, StaffUserUpdate } from "./schemas";

function serializeAuthUser(row: NonNullable<Awaited<ReturnType<typeof repository.findAuthUserById>>>) {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		emailVerified: row.emailVerified,
		role: row.role ?? null,
		banned: row.banned ?? null,
		banReason: row.banReason ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function serializeProfile(row: NonNullable<Awaited<ReturnType<typeof repository.findProfileById>>>) {
	return {
		...row,
		birthDate: row.birthDate ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

export async function listUsers(c: Context<{ Bindings: CloudflareBindings }>, query: StaffUserListQuery) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const [users, total] = await Promise.all([
		repository.listProfiles(db, query),
		repository.countProfiles(db, query),
	]);

	return {
		users: users.map((row) => ({
			profileId: row.profileId,
			userId: row.userId,
			displayName: row.displayName,
			email: row.email,
			isSynthetic: row.isSynthetic,
			lookingFor: row.lookingFor,
			createdAt: row.createdAt.toISOString(),
		})),
		total,
		limit: query.limit,
		offset: query.offset,
	};
}

export async function getUser(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const profile = await repository.findProfileById(db, profileId);
	if (!profile) {
		throw errors.not_found;
	}

	const auth = profile.userId ? await repository.findAuthUserById(db, profile.userId) : null;

	return {
		profile: serializeProfile(profile),
		auth: auth ? serializeAuthUser(auth) : null,
	};
}

export async function updateUser(
	c: Context<{ Bindings: CloudflareBindings }>,
	profileId: number,
	body: StaffUserUpdate,
) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const existing = await repository.findProfileById(db, profileId);
	if (!existing) {
		throw errors.not_found;
	}

	const { authName, authEmail, ...profileUpdates } = body;

	let profile = existing;
	if (Object.keys(profileUpdates).length > 0) {
		const updated = await repository.updateProfileById(db, profileId, profileUpdates as ProfileUpdate);
		if (!updated) {
			throw errors.not_found;
		}
		profile = updated;
	}

	let auth = existing.userId ? await repository.findAuthUserById(db, existing.userId) : null;
	if (existing.userId && (authName !== undefined || authEmail !== undefined)) {
		const authUpdates: { name?: string; email?: string } = {};
		if (authName !== undefined) {
			authUpdates.name = authName;
		}
		if (authEmail !== undefined) {
			authUpdates.email = authEmail;
		}

		const updatedAuth = await repository.updateAuthUserById(db, existing.userId, authUpdates);
		if (updatedAuth) {
			auth = updatedAuth;
		}
	}

	return {
		profile: serializeProfile(profile),
		auth: auth ? serializeAuthUser(auth) : null,
	};
}

export async function deleteUser(c: Context<{ Bindings: CloudflareBindings }>, profileId: number) {
	await requireStaffAdmin(c);
	const db = getDb(c.env.DATABASE_URL);

	const existing = await repository.findProfileById(db, profileId);
	if (!existing) {
		throw errors.not_found;
	}

	const authUserId = existing.userId;

	await repository.deleteProfileById(db, profileId);

	if (authUserId) {
		await repository.deleteAuthUserById(db, authUserId);
	}

	return { deleted: true, profileId };
}

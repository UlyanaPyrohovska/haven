/**
 * Gives one account a few ready-made matches with synthetic profiles from its own pool, each with
 * an unread synthetic opener so the inbox and the home badge have something to show.
 * Skips candidates the account already has an interaction with, so reruns only add new matches.
 *
 *   pnpm db:seed-matches -- <email> [count=5]
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { and, eq, notInArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { interactions, messages, recommendations, user, userProfiles } from "../src/db/schema";
import { syntheticOpener } from "../src/lib/messaging/chat";
import { haversineKm, sharedInterestLabels } from "../src/lib/profile/profile-view";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");

config({ path: join(apiRoot, "../..", ".env") });
config({ path: join(apiRoot, ".env") });

async function main() {
	const [email, countArg] = process.argv.slice(2).filter((arg) => arg !== "--");
	const count = Number(countArg ?? 5);

	if (!email || !Number.isInteger(count) || count < 1) {
		throw new Error("Usage: pnpm db:seed-matches -- <email> [count]");
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("Missing env variable: DATABASE_URL");
	}

	const pool = new pg.Pool({ connectionString: databaseUrl });
	const db = drizzle(pool);

	try {
		const [viewer] = await db
			.select({ profile: userProfiles })
			.from(userProfiles)
			.innerJoin(user, eq(user.id, userProfiles.userId))
			.where(eq(user.email, email))
			.limit(1);

		if (!viewer) {
			throw new Error(`No profile for ${email}`);
		}

		const me = viewer.profile;
		const existing = await db
			.select({ userA: interactions.userA, userB: interactions.userB })
			.from(interactions)
			.where(or(eq(interactions.userA, me.id), eq(interactions.userB, me.id)));
		const taken = [me.id, ...existing.map((row) => (row.userA === me.id ? row.userB : row.userA))];

		// Prefer people already recommended to this account (best score first), then anyone in the pool.
		const recommended = await db
			.select({ profile: userProfiles })
			.from(recommendations)
			.innerJoin(userProfiles, eq(userProfiles.id, recommendations.candidateId))
			.where(
				and(
					eq(recommendations.userId, me.id),
					eq(userProfiles.isSynthetic, true),
					eq(userProfiles.lookingFor, me.lookingFor),
					notInArray(userProfiles.id, taken),
				),
			)
			.orderBy(sql`${recommendations.score} desc nulls last`)
			.limit(count);
		const candidates = recommended.map((row) => row.profile);

		if (candidates.length < count) {
			const others = await db
				.select()
				.from(userProfiles)
				.where(
					and(
						eq(userProfiles.isSynthetic, true),
						eq(userProfiles.lookingFor, me.lookingFor),
						notInArray(userProfiles.id, [...taken, ...candidates.map((c) => c.id)]),
					),
				)
				.limit(count - candidates.length);
			candidates.push(...others);
		}

		for (const candidate of candidates) {
			await db.transaction(async (tx) => {
				const [interaction] = await tx
					.insert(interactions)
					.values({
						userA: me.id,
						userB: candidate.id,
						distanceKm: haversineKm(me.latitude, me.longitude, candidate.latitude, candidate.longitude),
						decA: 1,
						decB: 1,
						match: true,
					})
					.returning({ id: interactions.id });
				await tx.insert(messages).values({
					interactionId: interaction.id,
					senderId: candidate.id,
					body: syntheticOpener(sharedInterestLabels(candidate, me), interaction.id),
				});
			});
		}

		console.log(`Added ${candidates.length} matches for ${email} (profile ${me.id}).`);
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

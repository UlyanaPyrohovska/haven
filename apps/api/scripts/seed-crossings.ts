/**
 * Seeds simulated "crossed paths" counts (W1.6). Nothing is tracked — counts are synthetic and
 * derived from approximate profile coordinates only. Idempotent: truncates `crossings` first.
 *
 *   pnpm db:seed-crossings
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { and, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { crossings, userProfiles } from "../src/db/schema";
import { haversineKm } from "../src/lib/profile-view";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");

config({ path: join(apiRoot, "../..", ".env") });
config({ path: join(apiRoot, ".env") });

const MAX_KM = 10;
/** Nearest neighbours considered per synthetic profile; keeps the table small in dense areas. */
const NEIGHBOURS = 15;
const KEEP_PROBABILITY = 0.2;
const PARTICIPANT_CROSSINGS = [2, 3] as const;
const RECENT_DAYS = 14;
const BATCH_SIZE = 500;
const PLACES = [
	"Avenida Luísa Todi",
	"Praça do Bocage",
	"Mercado do Livramento",
	"Parque do Bonfim",
	"Doca de Recreio das Fontainhas",
	"Jardim da Beira-Mar",
	"Estação de Setúbal",
	"Praia da Figueirinha",
];

type Profile = { id: number; lat: number; lon: number; lookingFor: number; isSynthetic: boolean };
type CrossingRow = typeof crossings.$inferInsert;

/** mulberry32 — seeded so reruns produce the same crossings. */
function createRandom(seed: number) {
	let state = seed >>> 0;

	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = createRandom(20260614);

function poisson(lambda: number): number {
	const limit = Math.exp(-lambda);
	let k = 0;
	let p = random();

	while (p > limit) {
		k++;
		p *= random();
	}

	return k;
}

function pick<T>(items: readonly T[]): T {
	return items[Math.floor(random() * items.length)];
}

function nearest(profile: Profile, others: Profile[], limit: number) {
	return others
		.filter((other) => other.id !== profile.id && other.lookingFor === profile.lookingFor)
		.map((other) => ({ other, km: haversineKm(profile.lat, profile.lon, other.lat, other.lon) ?? Infinity }))
		.filter(({ km }) => km <= MAX_KM)
		.sort((a, b) => a.km - b.km)
		.slice(0, limit);
}

function crossingRow(a: number, b: number, km: number, now: number): CrossingRow {
	const closeness = 1 - km / MAX_KM;

	return {
		userA: Math.min(a, b),
		userB: Math.max(a, b),
		count: 1 + poisson(2 * closeness),
		lastCrossedAt: new Date(now - random() * RECENT_DAYS * 24 * 60 * 60 * 1000),
		lastPlace: pick(PLACES),
	};
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("Missing env variable: DATABASE_URL");
	}

	const pool = new pg.Pool({ connectionString: databaseUrl });
	const db = drizzle(pool);

	try {
		const rows = await db
			.select({
				id: userProfiles.id,
				lat: userProfiles.latitude,
				lon: userProfiles.longitude,
				lookingFor: userProfiles.lookingFor,
				isSynthetic: userProfiles.isSynthetic,
			})
			.from(userProfiles)
			.where(and(isNotNull(userProfiles.latitude), isNotNull(userProfiles.longitude)))
			.orderBy(userProfiles.id);
		const profiles = rows as Profile[];
		const synthetic = profiles.filter((profile) => profile.isSynthetic);
		const participants = profiles.filter((profile) => !profile.isSynthetic);
		const now = Date.now();
		const pairs = new Map<string, CrossingRow>();
		const add = (row: CrossingRow) => pairs.set(`${row.userA}:${row.userB}`, row);

		for (const profile of synthetic) {
			for (const { other, km } of nearest(profile, synthetic, NEIGHBOURS)) {
				if (random() < KEEP_PROBABILITY) {
					add(crossingRow(profile.id, other.id, km, now));
				}
			}
		}

		for (const participant of participants) {
			const howMany = pick(PARTICIPANT_CROSSINGS);

			for (const { other, km } of nearest(participant, synthetic, howMany)) {
				add(crossingRow(participant.id, other.id, km, now));
			}
		}

		const values = [...pairs.values()];

		await db.execute(sql`TRUNCATE TABLE crossings`);

		for (let i = 0; i < values.length; i += BATCH_SIZE) {
			await db.insert(crossings).values(values.slice(i, i + BATCH_SIZE));
		}

		const participantRows = values.filter((row) =>
			participants.some((p) => p.id === row.userA || p.id === row.userB),
		).length;

		console.log(
			`Seeded ${values.length} crossings (${participantRows} involving ${participants.length} participants).`,
		);
	} finally {
		await pool.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});

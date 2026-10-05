import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Papa from "papaparse";
import pg from "pg";
import { friendships, interactions, userProfiles } from "../src/db/schema";
import { syntheticDisplayName } from "../src/lib/candidate-display";
import { lookingForFromGoal } from "../src/lib/looking-for";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");
const repoRoot = resolve(apiRoot, "../..");

config({ path: join(repoRoot, ".env") });
config({ path: join(apiRoot, ".env") });

const EXPECTED_COUNTS = {
	users: 2000,
	interactions: 98780,
	friendships: 7936,
} as const;

/** Dataset generation timestamp — keeps derived birth dates stable across runs. */
const REFERENCE_DATE = new Date(Date.UTC(2026, 5, 14));

const BATCH_SIZE = 500;

type CsvRow = Record<string, string>;

function resolveDatasetDir(): string {
	const fromEnv = process.env.DATASET_DIR?.trim();
	const cliArgs = process.argv.slice(2).filter((arg) => arg !== "--");
	const fromArg = cliArgs[0]?.trim();

	const datasetDir = fromArg || fromEnv;
	if (!datasetDir) {
		throw new Error(
			"Missing dataset path. Set DATASET_DIR or pass it as the first argument:\n" +
				"  pnpm db:seed -- /path/to/Dataset",
		);
	}

	return resolve(datasetDir);
}

function readCsv(path: string): CsvRow[] {
	const text = readFileSync(path, "utf8");
	const parsed = Papa.parse<CsvRow>(text, {
		header: true,
		skipEmptyLines: true,
	});

	if (parsed.errors.length > 0) {
		const detail = parsed.errors.map((error) => `${error.type} at row ${error.row}: ${error.message}`).join("\n");
		throw new Error(`Failed to parse ${path}:\n${detail}`);
	}

	return parsed.data;
}

function parseIntField(row: CsvRow, key: string): number {
	const value = Number.parseInt(row[key], 10);
	if (Number.isNaN(value)) {
		throw new Error(`Invalid integer for ${key}: ${row[key]}`);
	}
	return value;
}

function parseFloatField(row: CsvRow, key: string): number {
	const value = Number.parseFloat(row[key]);
	if (Number.isNaN(value)) {
		throw new Error(`Invalid float for ${key}: ${row[key]}`);
	}
	return value;
}

function birthDateFromAge(age: number): string {
	const birth = new Date(
		Date.UTC(REFERENCE_DATE.getUTCFullYear() - age, REFERENCE_DATE.getUTCMonth(), REFERENCE_DATE.getUTCDate()),
	);
	return birth.toISOString().slice(0, 10);
}

function mapUserRow(row: CsvRow) {
	const id = parseIntField(row, "uid");
	const gender = parseIntField(row, "gender");

	return {
		id,
		isSynthetic: true,
		displayName: syntheticDisplayName({ id, gender }),
		gender,
		birthDate: birthDateFromAge(parseIntField(row, "age")),
		ethnicity: row.ethnicity,
		career: row.career,
		lookingFor: lookingForFromGoal(row.goal),
		goal: row.goal,
		latitude: parseFloatField(row, "latitude"),
		longitude: parseFloatField(row, "longitude"),
		bio: row.bio,
		interestSports: parseIntField(row, "interest_sports"),
		interestTvsports: parseIntField(row, "interest_tvsports"),
		interestExercise: parseIntField(row, "interest_exercise"),
		interestDining: parseIntField(row, "interest_dining"),
		interestMuseums: parseIntField(row, "interest_museums"),
		interestArt: parseIntField(row, "interest_art"),
		interestHiking: parseIntField(row, "interest_hiking"),
		interestGaming: parseIntField(row, "interest_gaming"),
		interestClubbing: parseIntField(row, "interest_clubbing"),
		interestReading: parseIntField(row, "interest_reading"),
		interestTv: parseIntField(row, "interest_tv"),
		interestTheater: parseIntField(row, "interest_theater"),
		interestMovies: parseIntField(row, "interest_movies"),
		interestConcerts: parseIntField(row, "interest_concerts"),
		interestMusic: parseIntField(row, "interest_music"),
		interestShopping: parseIntField(row, "interest_shopping"),
		interestYoga: parseIntField(row, "interest_yoga"),
		prefAttr: parseFloatField(row, "pref_attr"),
		prefSinc: parseFloatField(row, "pref_sinc"),
		prefIntel: parseFloatField(row, "pref_intel"),
		prefFun: parseFloatField(row, "pref_fun"),
		prefAmb: parseFloatField(row, "pref_amb"),
		prefShar: parseFloatField(row, "pref_shar"),
		selfAttr: parseIntField(row, "self_attr"),
		selfSinc: parseIntField(row, "self_sinc"),
		selfIntel: parseIntField(row, "self_intel"),
		selfFun: parseIntField(row, "self_fun"),
		selfAmb: parseIntField(row, "self_amb"),
		selfShar: parseIntField(row, "self_shar"),
	};
}

function mapInteractionRow(row: CsvRow) {
	return {
		userA: parseIntField(row, "user_a"),
		userB: parseIntField(row, "user_b"),
		distanceKm: parseFloatField(row, "distance_km"),
		scoreAToB: parseFloatField(row, "score_a_to_b"),
		scoreBToA: parseFloatField(row, "score_b_to_a"),
		decA: parseIntField(row, "dec_a"),
		decB: parseIntField(row, "dec_b"),
		match: parseIntField(row, "match") === 1,
	};
}

function mapFriendshipRow(row: CsvRow) {
	const userA = parseIntField(row, "user_a");
	const userB = parseIntField(row, "user_b");
	return {
		userA: Math.min(userA, userB),
		userB: Math.max(userA, userB),
	};
}

async function batchInsert<T extends Record<string, unknown>>(
	label: string,
	rows: T[],
	insert: (batch: T[]) => Promise<unknown>,
) {
	for (let index = 0; index < rows.length; index += BATCH_SIZE) {
		const batch = rows.slice(index, index + BATCH_SIZE);
		await insert(batch);
		const done = Math.min(index + BATCH_SIZE, rows.length);
		process.stdout.write(`\r  ${label}: ${done}/${rows.length}`);
	}
	process.stdout.write("\n");
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("Missing env variable: DATABASE_URL");
	}

	const datasetDir = resolveDatasetDir();
	const usersPath = join(datasetDir, "synthetic_users.csv");
	const interactionsPath = join(datasetDir, "synthetic_interactions.csv");
	const friendshipsPath = join(datasetDir, "synthetic_friendships.csv");

	console.log(`Reading CSVs from ${datasetDir}`);

	const userRows = readCsv(usersPath).map(mapUserRow);
	const interactionRows = readCsv(interactionsPath).map(mapInteractionRow);
	const friendshipRows = readCsv(friendshipsPath).map(mapFriendshipRow);

	if (userRows.length !== EXPECTED_COUNTS.users) {
		throw new Error(`Expected ${EXPECTED_COUNTS.users} users, got ${userRows.length}`);
	}
	if (interactionRows.length !== EXPECTED_COUNTS.interactions) {
		throw new Error(`Expected ${EXPECTED_COUNTS.interactions} interactions, got ${interactionRows.length}`);
	}
	if (friendshipRows.length !== EXPECTED_COUNTS.friendships) {
		throw new Error(`Expected ${EXPECTED_COUNTS.friendships} friendships, got ${friendshipRows.length}`);
	}

	const pool = new pg.Pool({ connectionString: databaseUrl });
	const db = drizzle(pool);

	try {
		const [beforeReal] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(userProfiles)
			.where(eq(userProfiles.isSynthetic, false));

		console.log("Clearing synthetic dataset…");
		// Derived tables only reference synthetic profile ids (1–2000). Real onboarding
		// profiles (`is_synthetic = false`) are left untouched.
		await db.execute(sql`
			TRUNCATE TABLE
				recommendations,
				user_embeddings,
				interactions,
				friendships
			RESTART IDENTITY
		`);
		await db.delete(userProfiles).where(eq(userProfiles.isSynthetic, true));

		console.log("Inserting user profiles…");
		await batchInsert("user_profiles", userRows, async (batch) => {
			await db.insert(userProfiles).values(batch);
		});

		console.log("Inserting interactions…");
		await batchInsert("interactions", interactionRows, async (batch) => {
			await db.insert(interactions).values(batch);
		});

		console.log("Inserting friendships…");
		await batchInsert("friendships", friendshipRows, async (batch) => {
			await db.insert(friendships).values(batch);
		});

		// Explicit ids (1–2000) do not advance the serial sequence; without this, the next
		// real profile insert would reuse an existing id and fail with a PK violation.
		await db.execute(sql`
			SELECT setval(
				pg_get_serial_sequence('user_profiles', 'id'),
				COALESCE((SELECT MAX(id) FROM user_profiles), 1)
			)
		`);

		const [syntheticCount] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(userProfiles)
			.where(eq(userProfiles.isSynthetic, true));
		const [realCount] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(userProfiles)
			.where(eq(userProfiles.isSynthetic, false));
		const [interactionCount] = await db.select({ count: sql<number>`count(*)::int` }).from(interactions);
		const [friendshipCount] = await db.select({ count: sql<number>`count(*)::int` }).from(friendships);

		console.log("\nSeed complete:");
		console.log(`  user_profiles (synthetic): ${syntheticCount.count}`);
		console.log(`  user_profiles (real):      ${realCount.count}`);
		console.log(`  interactions:              ${interactionCount.count}`);
		console.log(`  friendships:               ${friendshipCount.count}`);

		if (realCount.count !== beforeReal.count) {
			throw new Error(`Real profile count changed during seed (${beforeReal.count} → ${realCount.count})`);
		}

		if (
			syntheticCount.count !== EXPECTED_COUNTS.users ||
			interactionCount.count !== EXPECTED_COUNTS.interactions ||
			friendshipCount.count !== EXPECTED_COUNTS.friendships
		) {
			throw new Error("Post-seed synthetic row counts do not match the source CSVs");
		}
	} finally {
		await pool.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});

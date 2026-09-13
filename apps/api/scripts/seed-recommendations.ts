import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { recommendations, userProfiles } from "../src/db/schema";
import { DEMO_CANDIDATE_IDS } from "../src/lib/recommendation-demo-data";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");
const repoRoot = resolve(apiRoot, "../..");

config({ path: join(repoRoot, ".env") });
config({ path: join(apiRoot, ".env") });

const TARGET_AUTH_USER_ID = "geDPyOhAdIfpIDN0phDdEosOqFlIUqYb";

const SCORES = [0.91, 0.87, 0.84, 0.81, 0.78];

async function main() {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		throw new Error("DATABASE_URL is not set");
	}

	const pool = new pg.Pool({ connectionString });
	const db = drizzle(pool);

	try {
		const [viewer] = await db
			.select({ id: userProfiles.id, lookingFor: userProfiles.lookingFor })
			.from(userProfiles)
			.where(eq(userProfiles.userId, TARGET_AUTH_USER_ID))
			.limit(1);

		if (!viewer) {
			throw new Error(
				`No profile found for user_id ${TARGET_AUTH_USER_ID}. Complete onboarding first, then re-run this script.`,
			);
		}

		await db.delete(recommendations).where(eq(recommendations.userId, viewer.id));

		const candidates = await db
			.select({ id: userProfiles.id })
			.from(userProfiles)
			.where(eq(userProfiles.isSynthetic, true));

		const candidateSet = new Set(candidates.map((row) => row.id));
		const missing = DEMO_CANDIDATE_IDS.filter((id) => !candidateSet.has(id));

		if (missing.length > 0) {
			throw new Error(
				`Synthetic candidates missing from user_profiles: ${missing.join(", ")}. Run pnpm db:seed first.`,
			);
		}

		await db.insert(recommendations).values(
			DEMO_CANDIDATE_IDS.map((candidateId, index) => ({
				userId: viewer.id,
				candidateId,
				score: SCORES[index] ?? 0.75,
				rank: index + 1,
				actedOn: false,
			})),
		);

		const inserted = await db
			.select({ id: recommendations.id, candidateId: recommendations.candidateId, rank: recommendations.rank })
			.from(recommendations)
			.where(and(eq(recommendations.userId, viewer.id), eq(recommendations.actedOn, false)))
			.orderBy(recommendations.rank);

		console.log(`Seeded ${inserted.length} recommendations for profile #${viewer.id} (${TARGET_AUTH_USER_ID}):`);
		for (const row of inserted) {
			console.log(`  rank ${row.rank} → candidate #${row.candidateId}`);
		}
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

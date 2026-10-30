/**
 * Read-only. Samples random same-pool pairs and prints each scoring component's mean, standard deviation
 * and effective share of the ranking (`w·σ / Σ w·σ`), plus a `COMPONENT_CALIBRATION` block for `scoring.ts`.
 *
 *   pnpm --filter api db:component-stats -- [pairsPerPool=5000]
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { userProfiles } from "../src/db/schema";
import {
	bioSimilarity,
	DEFAULT_WEIGHTS,
	dailyAnswerSimilarity,
	directedPreferenceMatch,
	geoProximity,
	interestSimilarity,
	moodCompatibility,
	type ScoringProfile,
	type ScoringWeights,
} from "../src/lib/scoring";
import { listScoringProfilesByIds } from "../src/modules/recommendations/repository";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");

config({ path: join(apiRoot, "../..", ".env") });
config({ path: join(apiRoot, ".env") });

type Component = keyof ScoringWeights;

const COMPONENTS: Record<Component, (u: ScoringProfile, v: ScoringProfile) => number | null> = {
	interest: (u, v) => interestSimilarity(u.interests, v.interests, u.customInterests, v.customInterests),
	geo: (u, v) => geoProximity(u, v),
	pref: (u, v) => directedPreferenceMatch(u, v),
	bio: (u, v) => bioSimilarity(u.bioEmbedding, v.bioEmbedding),
	mood: (u, v) => moodCompatibility(u.mood, v.mood),
	dailyAnswer: (u, v) => dailyAnswerSimilarity(u.dailyAnswer, v.dailyAnswer),
};

function stats(values: number[]) {
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);

	return { mean, sd };
}

async function main() {
	const pairsPerPool = Number(process.argv.slice(2).find((arg) => arg !== "--") ?? 5000);
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("Missing env variable: DATABASE_URL");
	}

	const db = getDb(databaseUrl);
	const rows = await db
		.select({ id: userProfiles.id, lookingFor: userProfiles.lookingFor })
		.from(userProfiles)
		.where(eq(userProfiles.discoverable, true));
	const values = Object.fromEntries(Object.keys(COMPONENTS).map((key) => [key, [] as number[]])) as Record<
		Component,
		number[]
	>;

	// Pools never cross, so pairs are only drawn within one `lookingFor` pool.
	for (const lookingFor of new Set(rows.map((row) => row.lookingFor))) {
		const ids = rows.filter((row) => row.lookingFor === lookingFor).map((row) => row.id);
		const profiles = await listScoringProfilesByIds(db, ids);

		if (profiles.length < 2) {
			continue;
		}

		for (let n = 0; n < pairsPerPool; n++) {
			const u = profiles[Math.floor(Math.random() * profiles.length)];
			const v = profiles[Math.floor(Math.random() * profiles.length)];

			if (u.id === v.id) {
				continue;
			}

			for (const [key, score] of Object.entries(COMPONENTS) as [Component, (typeof COMPONENTS)[Component]][]) {
				const value = score(u, v);

				if (value !== null) {
					values[key].push(value);
				}
			}
		}
	}

	const table = (Object.keys(COMPONENTS) as Component[]).map((key) => ({
		component: key,
		n: values[key].length,
		...(values[key].length > 1 ? stats(values[key]) : { mean: Number.NaN, sd: Number.NaN }),
	}));
	const influence = table.map((row) => (Number.isFinite(row.sd) ? DEFAULT_WEIGHTS[row.component] * row.sd : 0));
	const totalInfluence = influence.reduce((sum, v) => sum + v, 0);

	console.table(
		table.map((row, i) => ({
			component: row.component,
			n: row.n,
			weight: DEFAULT_WEIGHTS[row.component],
			mean: row.mean.toFixed(3),
			sd: row.sd.toFixed(3),
			effectiveShare: totalInfluence > 0 ? (influence[i] / totalInfluence).toFixed(3) : "n/a",
		})),
	);
	console.log("\nCOMPONENT_CALIBRATION (paste into src/lib/scoring.ts):");
	console.log(
		JSON.stringify(
			Object.fromEntries(table.map((row) => [row.component, { mean: +row.mean.toFixed(4), sd: +row.sd.toFixed(4) }])),
			null,
			"\t",
		),
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

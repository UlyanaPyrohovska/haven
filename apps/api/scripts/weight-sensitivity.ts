/**
 * Read-only. Sensitivity of the ranking to the component weights.
 *
 * For a seeded sample of viewers in each pool, every other profile of the pool is ranked by the reciprocal
 * score with the default weights, then again with one weight changed at a time (halved, increased by half,
 * set to zero) and with random weight vectors drawn uniformly from the simplex. For each variant it prints
 * how much of the top-k list survives (overlap@4 is a daily batch, overlap@20 a wider shortlist) and the
 * Spearman rank correlation of the scores over the whole pool. Partner filters, the crossed-paths boost,
 * learned preferences and fairness are left out on purpose, so only the weights change between variants.
 *
 *   pnpm --filter api db:weight-sensitivity -- [viewersPerPool=100] [randomDraws=20]
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { userProfiles } from "../src/db/schema";
import { DEFAULT_WEIGHTS, reciprocalScore, type ScoringProfile, type ScoringWeights } from "../src/lib/matching/scoring";
import { seededRandom } from "../src/lib/simulation/agent-decision";
import { listScoringProfilesByIds } from "../src/modules/recommendations/repository";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");

config({ path: join(apiRoot, "../..", ".env") });
config({ path: join(apiRoot, ".env") });

type Component = keyof ScoringWeights;
const COMPONENTS = Object.keys(DEFAULT_WEIGHTS) as Component[];

function scores(viewer: ScoringProfile, pool: ScoringProfile[], weights: ScoringWeights) {
	return pool.map((candidate) => reciprocalScore(viewer, candidate, weights).reciprocal);
}

function topK(values: number[], k: number) {
	return new Set(
		values
			.map((score, i) => ({ score, i }))
			.sort((a, b) => b.score - a.score)
			.slice(0, k)
			.map((row) => row.i),
	);
}

function overlap(a: Set<number>, b: Set<number>) {
	let shared = 0;
	for (const x of a) if (b.has(x)) shared++;
	return shared / a.size;
}

function ranks(values: number[]) {
	const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
	const out = new Array<number>(values.length);
	order.forEach((row, r) => {
		out[row.i] = r;
	});
	return out;
}

function spearman(a: number[], b: number[]) {
	const ra = ranks(a);
	const rb = ranks(b);
	const n = a.length;
	const mean = (n - 1) / 2;
	let num = 0;
	let da = 0;
	let db = 0;
	for (let i = 0; i < n; i++) {
		num += (ra[i] - mean) * (rb[i] - mean);
		da += (ra[i] - mean) ** 2;
		db += (rb[i] - mean) ** 2;
	}
	return da === 0 || db === 0 ? 1 : num / Math.sqrt(da * db);
}

/** Uniform draw from the simplex (normalised exponentials), seeded. */
function randomWeights(seed: string): ScoringWeights {
	const raw = COMPONENTS.map((key) => -Math.log(1 - seededRandom(`${seed}:${key}`)));
	const total = raw.reduce((sum, v) => sum + v, 0);
	return Object.fromEntries(COMPONENTS.map((key, i) => [key, raw[i] / total])) as ScoringWeights;
}

async function main() {
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	const viewersPerPool = Number(args[0] ?? 100);
	const randomDraws = Number(args[1] ?? 20);
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("Missing env variable: DATABASE_URL");
	}

	const db = getDb({ DATABASE_URL: databaseUrl });
	const rows = await db
		.select({ id: userProfiles.id, lookingFor: userProfiles.lookingFor })
		.from(userProfiles)
		.where(eq(userProfiles.discoverable, true));

	const variants: { name: string; weights: ScoringWeights }[] = [];
	for (const key of COMPONENTS) {
		for (const [label, factor] of [
			["x0.5", 0.5],
			["x1.5", 1.5],
			["= 0", 0],
		] as const) {
			variants.push({ name: `${key} ${label}`, weights: { ...DEFAULT_WEIGHTS, [key]: DEFAULT_WEIGHTS[key] * factor } });
		}
	}
	for (let n = 0; n < randomDraws; n++) {
		variants.push({ name: `random ${n + 1}`, weights: randomWeights(`weights:${n}`) });
	}

	const results = new Map(variants.map((variant) => [variant.name, { o4: [] as number[], o20: [] as number[], rho: [] as number[] }]));

	for (const lookingFor of [...new Set(rows.map((row) => row.lookingFor))].sort()) {
		const ids = rows.filter((row) => row.lookingFor === lookingFor).map((row) => row.id);
		const profiles = await listScoringProfilesByIds(db, ids);
		const viewers = [...profiles]
			.sort((a, b) => seededRandom(`viewer:${a.id}`) - seededRandom(`viewer:${b.id}`))
			.slice(0, viewersPerPool);

		for (const viewer of viewers) {
			const pool = profiles.filter((p) => p.id !== viewer.id);
			const base = scores(viewer, pool, DEFAULT_WEIGHTS);
			const base4 = topK(base, 4);
			const base20 = topK(base, 20);

			for (const variant of variants) {
				const s = scores(viewer, pool, variant.weights);
				const r = results.get(variant.name)!;
				r.o4.push(overlap(base4, topK(s, 4)));
				r.o20.push(overlap(base20, topK(s, 20)));
				r.rho.push(spearman(base, s));
			}
		}
		console.log(`pool ${lookingFor}: ${profiles.length} profiles, ${viewers.length} viewers`);
	}

	const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;
	const rowsOut = variants.map(({ name }) => {
		const r = results.get(name)!;
		return { variant: name, "overlap@4": mean(r.o4).toFixed(2), "overlap@20": mean(r.o20).toFixed(2), spearman: mean(r.rho).toFixed(3) };
	});
	console.table(rowsOut.filter((row) => !row.variant.startsWith("random")));

	const random = rowsOut.filter((row) => row.variant.startsWith("random"));
	if (random.length > 0) {
		const col = (key: "overlap@4" | "overlap@20" | "spearman") => random.map((row) => Number(row[key]));
		const summary = (xs: number[]) => `mean ${mean(xs).toFixed(2)}, min ${Math.min(...xs).toFixed(2)}`;
		console.log(`\nrandom weights (${random.length} draws): overlap@4 ${summary(col("overlap@4"))}; overlap@20 ${summary(col("overlap@20"))}; spearman ${summary(col("spearman"))}`);
	}
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

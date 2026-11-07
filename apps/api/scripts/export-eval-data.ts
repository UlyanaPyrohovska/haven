/**
 * Read-only. Exports what the evaluation in Chapter 6 needs into eval-out/eval-data.json.
 *
 * Profiles are exported as the recommender sees them (scoring and partner-filter fields). For real users the
 * coordinates are rounded to two decimals (about 1 km) and no name, e-mail, photo, bio text, answer text or
 * message body is exported: bios are represented only by their embedding, answers and messages by counts.
 *
 *   pnpm --filter api db:export-eval
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { listScoringProfilesByIds } from "../src/modules/recommendations/repository";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const apiRoot = resolve(scriptDir, "..");

config({ path: join(apiRoot, "../..", ".env") });
config({ path: join(apiRoot, ".env") });

async function rows(db: ReturnType<typeof getDb>, query: ReturnType<typeof sql>) {
	const result = await db.execute(query);
	return result.rows;
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("Missing env variable: DATABASE_URL");
	}
	const db = getDb({ DATABASE_URL: databaseUrl });

	const meta = await rows(
		db,
		sql`select id, is_synthetic as "isSynthetic", discoverable, looking_for as "lookingFor", created_at as "createdAt",
		    (user_id is not null) as "hasAccount" from user_profiles`,
	);
	const ids = meta.map((row) => Number(row.id));
	const profiles = [];
	for (let i = 0; i < ids.length; i += 500) {
		profiles.push(...(await listScoringProfilesByIds(db, ids.slice(i, i + 500))));
	}
	const synthetic = new Set(meta.filter((row) => row.isSynthetic).map((row) => Number(row.id)));
	const round = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
	const exported = profiles.map((p) => {
		const { mood: _mood, dailyAnswer: _answer, ...rest } = p as typeof p & { mood?: unknown; dailyAnswer?: unknown };
		return synthetic.has(p.id) ? rest : { ...rest, latitude: round(p.latitude), longitude: round(p.longitude) };
	});

	const data = {
		exportedAt: new Date().toISOString(),
		meta,
		profiles: exported,
		interactions: await rows(
			db,
			sql`select id, user_a as "a", user_b as "b", dec_a as "decA", dec_b as "decB", match, score_a_to_b as "sAB",
			    score_b_to_a as "sBA", distance_km as "km", created_at as "createdAt" from interactions`,
		),
		recommendations: await rows(
			db,
			sql`select user_id as "viewer", candidate_id as "candidate", score, rank, shown_at as "shownAt", acted_on as "actedOn"
			    from recommendations`,
		),
		exposures: await rows(
			db,
			sql`select viewer_id as "viewer", candidate_id as "candidate", shown_at as "shownAt" from recommendation_exposures`,
		),
		crossings: await rows(
			db,
			sql`select user_a as "a", user_b as "b", count, last_crossed_at as "lastCrossedAt" from crossings`,
		),
		moods: await rows(
			db,
			sql`select m.user_profile_id as "profile", m.mood, m.checkin_date as "date" from mood_checkins m
			    join user_profiles p on p.id = m.user_profile_id where not p.is_synthetic`,
		),
		answers: await rows(
			db,
			sql`select a.user_profile_id as "profile", a.answer_date as "date", length(a.answer) as "length" from daily_question_answers a
			    join user_profiles p on p.id = a.user_profile_id where not p.is_synthetic`,
		),
		messages: await rows(
			db,
			sql`select interaction_id as "interaction", sender_id as "sender", created_at as "createdAt", (read_at is not null) as "read"
			    from messages`,
		),
		matchingConfig: (await rows(db, sql`select * from matching_config`)).map((row) =>
			Object.fromEntries(Object.entries(row).filter(([key]) => !/by$/i.test(key))),
		),
	};

	const outDir = join(apiRoot, "eval-out");
	mkdirSync(outDir, { recursive: true });
	const file = join(outDir, "eval-data.json");
	writeFileSync(file, JSON.stringify(data));
	console.log(
		`wrote ${file}: ${data.profiles.length} profiles, ${data.interactions.length} interactions, ${data.recommendations.length} recommendations, ${data.exposures.length} exposures`,
	);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

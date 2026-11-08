/**
 * Offline and simulation-based evaluation for Chapter 6, run on an export of the database
 * (eval-data.json from scripts/export-eval-data.ts) with the engine's own pure functions.
 *
 *   npx tsx ablations.ts <eval-data.json> <out.json> [days=14] [viewersPerPool=300]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { syntheticDailyAnswer } from "@/lib/daily/candidate-daily-answer";
import { syntheticMoodForProfile } from "@/lib/daily/candidate-mood";
import { FAIRNESS, gini, rerankForExposure } from "@/lib/matching/fairness";
import { mutualFilterMatch } from "@/lib/matching/partner-filters";
import { learnPreference, PREFERENCE_LEARNING, type PreferenceDecision } from "@/lib/matching/preference-learning";
import {
	bioSimilarity,
	COMPONENT_CALIBRATION,
	type ComponentCalibration,
	DEFAULT_WEIGHTS,
	reciprocalScore,
	type ScoringProfile,
	type ScoringWeights,
	unilateral,
} from "@/lib/matching/scoring";
import { AGENT, acceptProbability, agentAccepts, hiddenProfile, seededRandom } from "@/lib/simulation/agent-decision";
import { agentUtility } from "@/lib/simulation/agent-utility";

type P = ScoringProfile & {
	lookingFor: number;
	gender: number | null;
	birthDate: Date | null;
	interestedIn: number[] | null;
	prefAgeMin: number | null;
	prefAgeMax: number | null;
};

const [, , dataPath, outPath, daysArg, viewersArg, poolArg] = process.argv;
const DAYS = Number(daysArg ?? 14);
const VIEWERS = Number(viewersArg ?? 300);
const POOL_LIMIT = 500;
const ANN = 200;
const LIKER_SLOTS = 2;

const raw = JSON.parse(readFileSync(dataPath, "utf8"));
const metaById = new Map<number, any>(raw.meta.map((m: any) => [Number(m.id), m]));
const cfg = raw.matchingConfig?.[0] ?? {};
const K = Number(cfg.batch_size ?? 4);
const TODAY = new Date(raw.exportedAt);

const all: P[] = raw.profiles.map((p: any) => ({
	...p,
	birthDate: p.birthDate ? new Date(p.birthDate) : null,
	mood: null,
	dailyAnswer: null,
}));
const agents = all.filter((p) => metaById.get(p.id)?.isSynthetic && metaById.get(p.id)?.discoverable);
const pools = [...new Set(agents.map((a) => a.lookingFor))]
	.sort()
	.filter((p) => poolArg === undefined || String(p) === poolArg);
const byId = new Map(all.map((p) => [p.id, p]));

// ---------- ground truth: the agents' hidden preferences ----------
let NOISE: number = AGENT.hiddenNoise;
const hidden = new Map<number, ReturnType<typeof hiddenProfile>>();
function setNoise(noise: number) {
	NOISE = noise;
	hidden.clear();
	utilMemo.clear();
}
let DATE = "";
function setDate(date: string) {
	DATE = date;
	for (const p of agents) {
		p.mood = syntheticMoodForProfile(p.id, date);
		p.dailyAnswer = syntheticDailyAnswer(p.id, date);
	}
	hidden.clear();
	utilMemo.clear();
}
const dayDate = (day: number) => new Date(TODAY.getTime() + day * 86400000).toISOString().slice(0, 10);
const H = (u: P) => {
	let h = hidden.get(u.id);
	if (!h) {
		h = hiddenProfile(u, NOISE);
		hidden.set(u.id, h);
	}
	return h;
};
const utilMemo = new Map<number, number>();
const util = (u: P, v: P) => {
	const key = u.id * 1_000_003 + v.id;
	let x = utilMemo.get(key);
	if (x === undefined) {
		const h = H(u);
		x = agentUtility(h.profile, v, h.weights);
		utilMemo.set(key, x);
	}
	return x;
};
const THETA = Number(process.env.THETA ?? AGENT.threshold);
const QUICK = process.env.QUICK === "1";
const pAcc = (u: P, v: P) => acceptProbability(util(u, v), THETA);
const mutual = (u: P, v: P) => pAcc(u, v) * pAcc(v, u);
const relevant = (u: P, v: P) => util(u, v) >= THETA && util(v, u) >= THETA;

// ---------- eligibility (partner filters, same pool) ----------
const eligible = new Map<number, P[]>();
for (const pool of pools) {
	const members = agents.filter((a) => a.lookingFor === pool);
	for (const u of members) {
		eligible.set(
			u.id,
			members.filter((v) => v.id !== u.id && mutualFilterMatch(u, v, TODAY)),
		);
	}
}
// static part of the candidate pool: closest bios first (the ANN shortlist), seeded random order for the rest
const bioOrder = new Map<number, { near: P[]; rest: P[] }>();
for (const u of agents.filter((a) => pools.includes(a.lookingFor))) {
	const cands = eligible.get(u.id)!;
	if (!u.bioEmbedding) {
		bioOrder.set(u.id, { near: [], rest: cands });
		continue;
	}
	const sorted = [...cands].sort(
		(a, b) =>
			(bioSimilarity(u.bioEmbedding, b.bioEmbedding) ?? -1) - (bioSimilarity(u.bioEmbedding, a.bioEmbedding) ?? -1),
	);
	bioOrder.set(u.id, { near: sorted.slice(0, ANN), rest: sorted.slice(ANN) });
}

// ---------- variants ----------
type Variant = {
	name: string;
	score: "reciprocal" | "onesided" | "arithmetic" | "random" | "popularity";
	calibration: ComponentCalibration | null;
	weights: ScoringWeights;
	mu: number;
	cap: number | null;
	lambdaP: number;
};
const base: Variant = {
	name: "Full system",
	score: "reciprocal",
	calibration: COMPONENT_CALIBRATION,
	weights: DEFAULT_WEIGHTS,
	mu: Number(cfg.fairness_mu ?? FAIRNESS.mu),
	cap: cfg.exposure_cap ?? FAIRNESS.cap,
	lambdaP: Number(cfg.preference_lambda ?? PREFERENCE_LEARNING.lambda),
};
const VARIANTS: Variant[] = [
	base,
	{
		...base,
		name: "Without bio",
		weights: {
			bio: 0,
			interest: DEFAULT_WEIGHTS.interest,
			geo: DEFAULT_WEIGHTS.geo,
			pref: DEFAULT_WEIGHTS.pref,
			mood: DEFAULT_WEIGHTS.mood,
			dailyAnswer: DEFAULT_WEIGHTS.dailyAnswer,
		},
	},
	{
		...base,
		name: "Without interests",
		weights: {
			bio: DEFAULT_WEIGHTS.bio,
			interest: 0,
			geo: DEFAULT_WEIGHTS.geo,
			pref: DEFAULT_WEIGHTS.pref,
			mood: DEFAULT_WEIGHTS.mood,
			dailyAnswer: DEFAULT_WEIGHTS.dailyAnswer,
		},
	},
	{
		...base,
		name: "Without proximity",
		weights: {
			bio: DEFAULT_WEIGHTS.bio,
			interest: DEFAULT_WEIGHTS.interest,
			geo: 0,
			pref: DEFAULT_WEIGHTS.pref,
			mood: DEFAULT_WEIGHTS.mood,
			dailyAnswer: DEFAULT_WEIGHTS.dailyAnswer,
		},
	},
	{
		...base,
		name: "Without partner preferences",
		weights: {
			bio: DEFAULT_WEIGHTS.bio,
			interest: DEFAULT_WEIGHTS.interest,
			geo: DEFAULT_WEIGHTS.geo,
			pref: 0,
			mood: DEFAULT_WEIGHTS.mood,
			dailyAnswer: DEFAULT_WEIGHTS.dailyAnswer,
		},
	},
	{
		...base,
		name: "Without daily context",
		weights: {
			bio: DEFAULT_WEIGHTS.bio,
			interest: DEFAULT_WEIGHTS.interest,
			geo: DEFAULT_WEIGHTS.geo,
			pref: DEFAULT_WEIGHTS.pref,
			mood: 0,
			dailyAnswer: 0,
		},
	},
	{ ...base, name: "Bio only", weights: { bio: 1, interest: 0, geo: 0, pref: 0, mood: 0, dailyAnswer: 0 } },
	{ ...base, name: "Interests only", weights: { bio: 0, interest: 1, geo: 0, pref: 0, mood: 0, dailyAnswer: 0 } },
	{ ...base, name: "Random", score: "random", mu: 0, cap: null, lambdaP: 0 },
];

// popularity: likes received in the historical (seeded) interactions
const firstTs = Math.min(...raw.interactions.map((i: any) => Date.parse(i.createdAt)));
const isHistorical = (i: any) => Date.parse(i.createdAt) - firstTs < 6 * 3600 * 1000;
const historical = raw.interactions.filter(
	(i: any) => isHistorical(i) && metaById.get(Number(i.a))?.isSynthetic && metaById.get(Number(i.b))?.isSynthetic,
);
const likesReceived = new Map<number, number>();
for (const i of historical) {
	if (i.decA === 1) likesReceived.set(Number(i.b), (likesReceived.get(Number(i.b)) ?? 0) + 1);
	if (i.decB === 1) likesReceived.set(Number(i.a), (likesReceived.get(Number(i.a)) ?? 0) + 1);
}

function scorer(v: Variant, seed: string) {
	return (u: ScoringProfile, c: ScoringProfile): number => {
		switch (v.score) {
			case "random":
				return seededRandom(`${seed}:${u.id}:${c.id}`);
			case "popularity":
				return (likesReceived.get(c.id) ?? 0) + 0.001 * seededRandom(`${seed}:${c.id}`);
			case "onesided":
				return unilateral(u, c, v.weights, v.calibration);
			case "arithmetic": {
				const r = reciprocalScore(u, c, v.weights, v.calibration);
				return (r.pUToV + r.qVToU) / 2;
			}
			default:
				return reciprocalScore(u, c, v.weights, v.calibration).reciprocal;
		}
	};
}

// ---------- ranking metrics ----------
function rankingMetrics(list: P[], u: P, k: number) {
	const rel = list.map((c) => (relevant(u, c) ? 1 : 0));
	const gains = list.map((c) => mutual(u, c));
	const topRel = rel.slice(0, k);
	const firstRel = rel.indexOf(1);
	const dcg = (g: number[]) => g.reduce((s, x, i) => s + x / Math.log2(i + 2), 0);
	const ideal = [...gains].sort((a, b) => b - a);
	return {
		precision: topRel.reduce((s, x) => s + x, 0) / k,
		hit: topRel.some((x) => x === 1) ? 1 : 0,
		mrr: firstRel >= 0 ? 1 / (firstRel + 1) : 0,
		ndcg10: dcg(gains.slice(0, 10)) / (dcg(ideal.slice(0, 10)) || 1),
		mutualAtK: gains.slice(0, k).reduce((s, x) => s + x, 0) / k,
		anyRelevant: rel.some((x) => x === 1) ? 1 : 0,
	};
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const sd = (xs: number[]) => {
	const m = mean(xs);
	return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

// ---------- Experiment 1: offline ranking on the hidden preferences (cold start, full eligible pool) ----------
function offline(
	variants: Variant[] = VARIANTS.filter((x) => !["Without fairness", "Without learned preferences"].includes(x.name)),
) {
	const out: any = {};
	for (const pool of pools) {
		const members = agents.filter((a) => a.lookingFor === pool);
		const viewers = [...members]
			.sort((a, b) => seededRandom(`v:${a.id}`) - seededRandom(`v:${b.id}`))
			.slice(0, VIEWERS);
		out[pool] = {};
		for (const v of variants) {
			const s = scorer(v, "offline");
			const rows = viewers
				.filter((u) => eligible.get(u.id)!.length >= 10)
				.map((u) => {
					const list = [...eligible.get(u.id)!]
						.map((c) => ({ c, s: s(u, c) }))
						.sort((a, b) => b.s - a.s)
						.map((x) => x.c);
					return rankingMetrics(list, u, K);
				});
			out[pool][v.name] = Object.fromEntries(
				Object.keys(rows[0]).map((key) => [key, mean(rows.map((r: any) => r[key]))]),
			);
			out[pool][v.name].viewers = rows.length;
		}
		out[pool].baseRate = mean(
			viewers.flatMap((u) =>
				eligible
					.get(u.id)!
					.slice(0, 200)
					.map((c) => (relevant(u, c) ? 1 : 0)),
			),
		);
		console.log(`offline pool ${pool} done`);
	}
	return out;
}

// ---------- Experiment 2: historical decisions (seeded interactions derived from the Speed Dating waves) ----------
function historicalEval() {
	const partners = new Map<number, { other: number; match: boolean }[]>();
	for (const i of historical) {
		for (const [x, y] of [
			[Number(i.a), Number(i.b)],
			[Number(i.b), Number(i.a)],
		]) {
			const list = partners.get(x) ?? [];
			list.push({ other: y, match: !!i.match });
			partners.set(x, list);
		}
	}
	const out: any = { users: 0, meanList: 0, variants: {} };
	const users = [...partners.entries()].filter(
		([u, l]) => byId.has(u) && l.length >= 5 && l.some((x) => x.match) && l.some((x) => !x.match),
	);
	out.users = users.length;
	out.meanList = mean(users.map(([, l]) => l.length));
	out.meanMatches = mean(users.map(([, l]) => l.filter((x) => x.match).length));
	for (const v of VARIANTS.filter(
		(x) => !["Without fairness", "Without learned preferences", "Popularity"].includes(x.name),
	)) {
		const s = scorer(v, "hist");
		const m = { p3: [] as number[], hit3: [] as number[], mrr: [] as number[], auc: [] as number[] };
		for (const [uid, list] of users) {
			const u = byId.get(uid)!;
			const scored = list
				.filter((x) => byId.has(x.other))
				.map((x) => ({ ...x, s: s(u, byId.get(x.other)!) }))
				.sort((a, b) => b.s - a.s);
			const rel = scored.map((x) => (x.match ? 1 : 0));
			m.p3.push(rel.slice(0, 3).reduce((a, b) => a + b, 0) / 3);
			m.hit3.push(rel.slice(0, 3).some((x) => x) ? 1 : 0);
			m.mrr.push(1 / (rel.indexOf(1) + 1));
			const pos = scored.filter((x) => x.match);
			const neg = scored.filter((x) => !x.match);
			let wins = 0;
			for (const a of pos) for (const b of neg) wins += a.s > b.s ? 1 : a.s === b.s ? 0.5 : 0;
			m.auc.push(wins / (pos.length * neg.length));
		}
		out.variants[v.name] = Object.fromEntries(Object.entries(m).map(([k2, xs]) => [k2, mean(xs)]));
	}
	return out;
}

// ---------- Experiment 3: multi-day simulation ----------
type Inter = { a: number; b: number; decA: number | null; decB: number | null };
function simulate(v: Variant, pool: number) {
	const members = agents.filter((a) => a.lookingFor === pool);
	const inter = new Map<string, Inter>();
	const key = (x: number, y: number) => (x < y ? `${x}:${y}` : `${y}:${x}`);
	const decisions = new Map<number, PreferenceDecision[]>();
	const exposureLog: { day: number; id: number }[] = [];
	const exposuresTotal = new Map<number, number>();
	const matches = new Map<number, number>();
	const daily: any[] = [];
	const s = scorer(v, `sim:${v.name}`);
	let likes = 0;
	let decisionsN = 0;
	let matchCount = 0;

	const decide = (u: P, c: P, day: number) => {
		const accept = seededRandom(`${day}:${u.id}:${c.id}`) < acceptProbability(util(u, c), THETA);
		decisionsN++;
		const list = decisions.get(u.id) ?? [];
		list.push({ self: c.self, liked: accept });
		decisions.set(u.id, list);
		return accept;
	};
	const record = (u: P, c: P, day: number) => {
		const k2 = key(u.id, c.id);
		const existing = inter.get(k2);
		const accept = decide(u, c, day);
		if (accept) likes++;
		if (existing && existing.a === c.id && existing.decB === null) {
			existing.decB = accept ? 1 : 0;
			if (accept && existing.decA === 1) {
				matchCount++;
				matches.set(u.id, (matches.get(u.id) ?? 0) + 1);
				matches.set(c.id, (matches.get(c.id) ?? 0) + 1);
				return true;
			}
		} else if (!existing) {
			inter.set(k2, { a: u.id, b: c.id, decA: accept ? 1 : 0, decB: null });
		}
		return false;
	};

	for (let day = 1; day <= DAYS; day++) {
		setDate(dayDate(day));
		let dayMatches = 0;
		const dayMutual: number[] = [];
		// 1. agents answer the likes they received
		for (const it of [...inter.values()]) {
			if (it.decA === 1 && it.decB === null) {
				const recipient = byId.get(it.b)!;
				if (record(recipient, byId.get(it.a)!, day)) dayMatches++;
			}
		}
		// learned preferences as of the start of the day
		const learned = new Map<number, { direction: number[]; share: number } | null>();
		if (v.lambdaP > 0)
			for (const m of members) learned.set(m.id, learnPreference(decisions.get(m.id) ?? [], v.lambdaP));
		const withLearned = (p: P): P => {
			const l = learned.get(p.id);
			return l ? { ...p, learnedPref: l.direction, learnedShare: l.share } : p;
		};
		// 2. every agent receives a batch and decides on it
		const order = [...members].sort((a, b) => seededRandom(`o:${day}:${a.id}`) - seededRandom(`o:${day}:${b.id}`));
		const since = day - FAIRNESS.windowDays;
		const counts = new Map<number, number>();
		for (const e of exposureLog) if (e.day > since) counts.set(e.id, (counts.get(e.id) ?? 0) + 1);
		for (const u of order) {
			const open = (c: P) => {
				const it = inter.get(key(u.id, c.id));
				return !it || (it.a === c.id && it.decA === 1 && it.decB === null);
			};
			const { near, rest } = bioOrder.get(u.id)!;
			const nearOpen = near.filter(open);
			const restOpen = rest
				.filter(open)
				.sort((a, b) => seededRandom(`p:${day}:${u.id}:${a.id}`) - seededRandom(`p:${day}:${u.id}:${b.id}`))
				.slice(0, POOL_LIMIT - nearOpen.length);
			const cands = [...nearOpen, ...restOpen];
			if (cands.length === 0) continue;
			const likers = new Set(cands.filter((c) => inter.get(key(u.id, c.id))?.a === c.id).map((c) => c.id));
			const lu = withLearned(u);
			const ranked = cands
				.map((c) => ({ candidateId: c.id, score: s(lu, withLearned(c)) }))
				.sort((a, b) => Number(likers.has(b.candidateId)) - Number(likers.has(a.candidateId)) || b.score - a.score);
			const reserved = new Set(
				ranked
					.filter((r) => likers.has(r.candidateId))
					.slice(0, LIKER_SLOTS)
					.map((r) => r.candidateId),
			);
			const batch = rerankForExposure(ranked, counts, K, { mu: v.mu, cap: v.cap }, reserved);
			for (const r of batch) {
				const c = byId.get(r.candidateId)!;
				exposureLog.push({ day, id: c.id });
				counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
				exposuresTotal.set(c.id, (exposuresTotal.get(c.id) ?? 0) + 1);
				dayMutual.push(mutual(u, c));
				if (record(u, c, day)) dayMatches++;
			}
		}
		daily.push({ day, matches: dayMatches, meanMutual: mean(dayMutual) });
	}

	const exp = members.map((m) => exposuresTotal.get(m.id) ?? 0);
	const sortedExp = [...exp].sort((a, b) => b - a);
	const top10 =
		sortedExp.slice(0, Math.ceil(members.length / 10)).reduce((a, b) => a + b, 0) /
		(sortedExp.reduce((a, b) => a + b, 0) || 1);
	const matchCounts = members.map((m) => matches.get(m.id) ?? 0);

	// recovery of hidden preferences: learned direction vs the hidden trait preference (both centred)
	let recovery: any = null;
	if (v.lambdaP > 0) {
		const centred = (x: number[]) => {
			const m = mean(x);
			const s2 = sd(x) || 1;
			return x.map((y) => (y - m) / s2);
		};
		const cos = (a: number[], b: number[]) => {
			let d = 0,
				na = 0,
				nb = 0;
			for (let i = 0; i < a.length; i++) {
				d += a[i] * b[i];
				na += a[i] ** 2;
				nb += b[i] ** 2;
			}
			return na && nb ? d / Math.sqrt(na * nb) : 0;
		};
		const learnedCos: number[] = [];
		const statedCos: number[] = [];
		const shares: number[] = [];
		for (const m of members) {
			const l = learnPreference(decisions.get(m.id) ?? [], v.lambdaP);
			const hp = centred(H(m).profile.pref.map((x) => Number(x ?? 100 / 6)));
			statedCos.push(cos(centred(m.pref.map((x) => Number(x ?? 100 / 6))), hp));
			if (l) {
				learnedCos.push(cos(l.direction, hp));
				shares.push(l.share);
			}
		}
		recovery = {
			usersWithLearned: learnedCos.length,
			members: members.length,
			meanCosLearned: mean(learnedCos),
			meanCosStated: mean(statedCos),
			meanShare: mean(shares),
			meanDecisions: mean(members.map((m) => (decisions.get(m.id) ?? []).length)),
		};
	}

	return {
		members: members.length,
		likes,
		decisions: decisionsN,
		acceptRate: decisionsN ? likes / decisionsN : 0,
		matches: matchCount,
		matchesPerUser: (2 * matchCount) / members.length,
		matchRatePerLike: likes ? matchCount / likes : 0,
		shareWithMatch: matchCounts.filter((x) => x > 0).length / members.length,
		giniExposure: gini(exp),
		giniMatches: gini(matchCounts),
		coverage: exp.filter((x) => x > 0).length / members.length,
		top10Share: top10,
		meanMutual: mean(daily.map((d) => d.meanMutual)),
		daily,
		recovery,
	};
}

const result: any = {
	meta: {
		days: DAYS,
		batchSize: K,
		pools: Object.fromEntries(pools.map((p) => [p, agents.filter((a) => a.lookingFor === p).length])),
		eligibleMean: Object.fromEntries(
			pools.map((p) => [p, mean(agents.filter((a) => a.lookingFor === p).map((a) => eligible.get(a.id)!.length))]),
		),
		historicalInteractions: historical.length,
		config: {
			mu: base.mu,
			cap: base.cap,
			lambdaP: base.lambdaP,
			threshold: THETA,
			temperature: AGENT.temperature,
			noise: AGENT.hiddenNoise,
		},
	},
};
setDate(dayDate(0));
console.log(JSON.stringify(result.meta));
result.offline = offline(VARIANTS);
result.historical = historicalEval();
writeFileSync(outPath, JSON.stringify(result, null, 1));
process.exit(0);
if (QUICK) {
	for (const pool of pools) {
		const r = simulate(base, pool);
		delete r.daily;
		console.log(
			JSON.stringify({
				pool,
				theta: THETA,
				acceptRate: r.acceptRate,
				matchRatePerLike: r.matchRatePerLike,
				gini: r.giniExposure,
			}),
		);
	}
	process.exit(0);
}
result.offline = offline();
result.historical = historicalEval();
console.log("historical done");
result.noiseSweep = {};
for (const noise of [0, 0.25, 0.5, 0.75, 1]) {
	setNoise(noise);
	setDate(dayDate(0));
	result.noiseSweep[noise] = offline(
		VARIANTS.filter((x) => ["Full system", "Interests only", "Random"].includes(x.name)),
	);
}
setNoise(AGENT.hiddenNoise);
setDate(dayDate(0));
result.simulation = {};
result.muSweep = {};
result.reproducible = {};
for (const pool of pools) {
	result.simulation[pool] = {};
	for (const v of VARIANTS) {
		const t = Date.now();
		result.simulation[pool][v.name] = simulate(v, pool);
		const r = result.simulation[pool][v.name];
		console.log(
			pool,
			v.name,
			`${((Date.now() - t) / 1000).toFixed(0)}s`,
			r.matchesPerUser.toFixed(2),
			r.giniExposure.toFixed(3),
		);
	}
	const again = simulate(base, pool);
	result.reproducible[pool] = JSON.stringify(again) === JSON.stringify(result.simulation[pool]["Full system"]);
	result.muSweep[pool] = {};
	for (const mu of [0, 0.25, 0.5, 1.5, 2, 3]) {
		const r = simulate({ ...base, name: `mu ${mu}`, mu }, pool);
		delete r.daily;
		result.muSweep[pool][mu] = r;
		console.log(pool, "mu", mu, r.matchesPerUser.toFixed(2), r.giniExposure.toFixed(3));
	}
	result.muSweep[pool][1] = { ...result.simulation[pool]["Full system"] };
	writeFileSync(outPath, JSON.stringify(result, null, 1));
}
writeFileSync(outPath, JSON.stringify(result, null, 1));

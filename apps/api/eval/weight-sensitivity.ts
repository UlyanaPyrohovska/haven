import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_WEIGHTS, reciprocalScore, type ScoringWeights } from "@/lib/matching/scoring";
import { seededRandom } from "@/lib/simulation/agent-decision";

const [, , dataPath, outPath, nArg, drawsArg] = process.argv;
const raw = JSON.parse(readFileSync(dataPath, "utf8"));
const meta = new Map<number, any>(raw.meta.map((m: any) => [Number(m.id), m]));
const profiles = raw.profiles
	.filter((p: any) => meta.get(p.id)?.discoverable)
	.map((p: any) => ({ ...p, mood: null, dailyAnswer: null }));
type C = keyof ScoringWeights;
const COMPONENTS = (Object.keys(DEFAULT_WEIGHTS) as C[]).filter((k) => k !== "mood" && k !== "dailyAnswer");
const topK = (v: number[], k: number) =>
	new Set(
		v
			.map((s, i) => ({ s, i }))
			.sort((a, b) => b.s - a.s)
			.slice(0, k)
			.map((r) => r.i),
	);
const overlap = (a: Set<number>, b: Set<number>) => {
	let n = 0;
	for (const x of a) if (b.has(x)) n++;
	return n / a.size;
};
const ranks = (v: number[]) => {
	const o = v.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
	const r = new Array(v.length);
	o.forEach((x, j) => {
		r[x.i] = j;
	});
	return r;
};
const spearman = (a: number[], b: number[]) => {
	const ra = ranks(a),
		rb = ranks(b),
		n = a.length,
		m = (n - 1) / 2;
	let s = 0,
		da = 0,
		db = 0;
	for (let i = 0; i < n; i++) {
		s += (ra[i] - m) * (rb[i] - m);
		da += (ra[i] - m) ** 2;
		db += (rb[i] - m) ** 2;
	}
	return s / Math.sqrt(da * db);
};
const randomWeights = (seed: string): ScoringWeights => {
	const r = COMPONENTS.map((k) => -Math.log(1 - seededRandom(`${seed}:${k}`)));
	const t = r.reduce((a, b) => a + b, 0);
	return {
		...DEFAULT_WEIGHTS,
		...Object.fromEntries(
			COMPONENTS.map((k, i) => [k, (r[i] / t) * (1 - DEFAULT_WEIGHTS.mood - DEFAULT_WEIGHTS.dailyAnswer)]),
		),
	} as ScoringWeights;
};
const variants: { name: string; w: ScoringWeights }[] = [];
for (const k of COMPONENTS)
	for (const [l, f] of [
		["x0.5", 0.5],
		["x1.5", 1.5],
		["= 0", 0],
	] as const)
		variants.push({ name: `${k} ${l}`, w: { ...DEFAULT_WEIGHTS, [k]: DEFAULT_WEIGHTS[k] * f } });
for (let i = 0; i < Number(drawsArg ?? 20); i++)
	variants.push({ name: `random ${i + 1}`, w: randomWeights(`weights:${i}`) });
const res = new Map(variants.map((v) => [v.name, { o4: [] as number[], o20: [] as number[], rho: [] as number[] }]));
for (const lf of [...new Set(profiles.map((p: any) => p.lookingFor))]) {
	const pool = profiles.filter((p: any) => p.lookingFor === lf);
	const viewers = [...pool]
		.sort((a: any, b: any) => seededRandom(`viewer:${a.id}`) - seededRandom(`viewer:${b.id}`))
		.slice(0, Number(nArg ?? 100));
	for (const u of viewers as any[]) {
		const others = pool.filter((p: any) => p.id !== u.id);
		const base = others.map((c: any) => reciprocalScore(u, c, DEFAULT_WEIGHTS).reciprocal);
		const b4 = topK(base, 4),
			b20 = topK(base, 20);
		for (const v of variants) {
			const s = others.map((c: any) => reciprocalScore(u, c, v.w).reciprocal);
			const r = res.get(v.name)!;
			r.o4.push(overlap(b4, topK(s, 4)));
			r.o20.push(overlap(b20, topK(s, 20)));
			r.rho.push(spearman(base, s));
		}
	}
	console.log("pool", lf, pool.length);
}
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const out = variants.map((v) => {
	const r = res.get(v.name)!;
	return { variant: v.name, o4: mean(r.o4), o20: mean(r.o20), rho: mean(r.rho) };
});
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.table(out.filter((r) => !r.variant.startsWith("random")));
const rnd = out.filter((r) => r.variant.startsWith("random"));
console.log(
	"random",
	mean(rnd.map((r) => r.o4)),
	Math.min(...rnd.map((r) => r.o4)),
	mean(rnd.map((r) => r.o20)),
	mean(rnd.map((r) => r.rho)),
	Math.min(...rnd.map((r) => r.rho)),
);

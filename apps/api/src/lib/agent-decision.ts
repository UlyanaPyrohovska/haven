import { DEFAULT_WEIGHTS, type ScoringProfile, type ScoringWeights } from "@/lib/scoring";

/**
 * Decision rule for synthetic agents in the simulation engine. Pure and seeded, so a tick is
 * reproducible: the same (tick, agent, other) always draws the same number.
 */
export const AGENT = {
	/**
	 * How far an agent's hidden taste drifts from its stored profile (0 = decides on exactly what the
	 * recommender sees, 1 = stored profile ignored). Thesis ablation knob.
	 */
	hiddenNoise: 0.5,
	/** Directional score at which an agent accepts half the time. Thesis ablation knob. */
	threshold: 0.55,
	/** Softness of the sigmoid; smaller is pickier around the threshold. */
	temperature: 0.08,
	/** Agents sampled per tick (keeps a cron run inside the Worker subrequest budget). */
	defaultTickLimit: 50,
	/** Inbound likes answered per tick. */
	inboundLimit: 200,
} as const;

export function acceptProbability(
	score: number,
	threshold: number = AGENT.threshold,
	temperature: number = AGENT.temperature,
): number {
	return 1 / (1 + Math.exp(-(score - threshold) / temperature));
}

/** FNV-1a hash of the seed into mulberry32; returns a value in [0, 1). */
export function seededRandom(seed: string): number {
	let h = 0x811c9dc5;

	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}

	let t = (h + 0x6d2b79f5) | 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Pref vectors are a 100-point split over 6 traits; a random split averages to the neutral 100/6. */
const PREF_RANDOM_MAX = (2 * 100) / 6;

/**
 * The agent's hidden preference profile: its stored interests, partner preferences and component
 * weights, each blended with a random draw seeded by the agent id. It is stable across ticks and
 * never stored, so the recommender cannot see it, but it drives the agent's simulated decisions.
 */
export function hiddenProfile(
	agent: ScoringProfile,
	noise: number = AGENT.hiddenNoise,
): { profile: ScoringProfile; weights: ScoringWeights } {
	const draw = (key: string) => seededRandom(`hidden:${agent.id}:${key}`);
	const blend = (stated: number, random: number) => (1 - noise) * stated + noise * random;

	const interests = agent.interests.map((value, i) => blend(value ?? 5, 1 + 9 * draw(`interest:${i}`)));
	const pref = agent.pref.map((value, i) => blend(value ?? 100 / 6, PREF_RANDOM_MAX * draw(`pref:${i}`)));
	// unilateral renormalizes by the weights in play, so these need not sum to 1.
	const weights = Object.fromEntries(
		Object.entries(DEFAULT_WEIGHTS).map(([key, weight]) => [key, blend(weight, 2 * weight * draw(`weight:${key}`))]),
	) as ScoringWeights;

	return { profile: { ...agent, interests, pref }, weights };
}

export function agentAccepts(score: number, seed: string): boolean {
	return seededRandom(seed) < acceptProbability(score);
}

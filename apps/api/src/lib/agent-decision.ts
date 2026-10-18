/**
 * Decision rule for synthetic agents in the simulation engine. Pure and seeded, so a tick is
 * reproducible: the same (tick, agent, other) always draws the same number.
 */
export const AGENT = {
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

export function agentAccepts(score: number, seed: string): boolean {
	return seededRandom(seed) < acceptProbability(score);
}

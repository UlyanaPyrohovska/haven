export const Moods = {
	happy: 0,
	calm: 1,
	excited: 2,
	tired: 3,
	low: 4,
	stressed: 5,
} as const;

export type MoodValue = (typeof Moods)[keyof typeof Moods];
export type MoodSlug = keyof typeof Moods;

export const MoodSlugs = Object.keys(Moods) as MoodSlug[];

export function isMoodSlug(value: string): value is MoodSlug {
	return value in Moods;
}

export function moodCode(slug: MoodSlug): MoodValue {
	return Moods[slug];
}

export function moodSlug(code: number): MoodSlug | null {
	const entry = MoodSlugs.find((slug) => Moods[slug] === code);
	return entry ?? null;
}

/** UTC calendar date as `YYYY-MM-DD`. */
export function utcToday(): string {
	return new Date().toISOString().slice(0, 10);
}

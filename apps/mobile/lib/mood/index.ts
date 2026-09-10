export const MoodSlugs = ["happy", "calm", "excited", "tired", "low", "stressed"] as const;

export type MoodSlug = (typeof MoodSlugs)[number];

export function isMoodSlug(value: string): value is MoodSlug {
	return (MoodSlugs as readonly string[]).includes(value);
}

export const MoodEmoji: Record<MoodSlug, string> = {
	happy: "😊",
	calm: "😌",
	excited: "🤩",
	tired: "😴",
	low: "😔",
	stressed: "😰",
};

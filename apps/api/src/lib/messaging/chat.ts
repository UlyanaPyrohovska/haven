export const MESSAGE_MAX_LENGTH = 1000;
export const MESSAGE_PAGE_SIZE = 50;

/** Trims and collapses runs of 3+ newlines; returns null when nothing is left or it is too long. */
export function normalizeMessageBody(raw: string): string | null {
	const body = raw.trim().replace(/\n{3,}/g, "\n\n");

	if (body.length === 0 || body.length > MESSAGE_MAX_LENGTH) {
		return null;
	}

	return body;
}

const OPENERS_WITH_INTEREST = [
	"Hey! I saw we both love {interest} — what got you into it?",
	"Hi there! Fellow {interest} fan here. Any recommendations?",
	"Hello! {interest} seems to be our thing. What's your favourite part of it?",
	"Hey, nice to match! How long have you been into {interest}?",
] as const;

const OPENERS_GENERIC = [
	"Hey! Nice to match with you. How's your week going?",
	"Hi! What's something that made you smile today?",
	"Hello! What are you up to this weekend?",
] as const;

/** Deterministic first message a synthetic match sends; synthetic profiles never reply after it. */
export function syntheticOpener(sharedInterests: readonly string[], seed: number): string {
	const hash = (seed * 2654435761) >>> 0;
	const interest = sharedInterests[hash % Math.max(sharedInterests.length, 1)];

	if (interest) {
		return OPENERS_WITH_INTEREST[hash % OPENERS_WITH_INTEREST.length].replace("{interest}", interest.toLowerCase());
	}

	return OPENERS_GENERIC[hash % OPENERS_GENERIC.length];
}

/** Header the Worker sets on the internal upgrade request to a ChatRoom after checking session and match. */
export const CHAT_PROFILE_HEADER = "X-Haven-Profile-Id";

export type ChatMessagePayload = {
	id: number;
	senderId: number;
	body: string;
	createdAt: string;
};

/** User-created interests: shared catalog labels that sit alongside the 17 fixed `interest_*` columns. */

export const CUSTOM_INTEREST_MIN_LENGTH = 2;
export const CUSTOM_INTEREST_MAX_LENGTH = 30;
export const MAX_CUSTOM_INTERESTS = 10;

// shortcut: tiny inline blocklist matched on whole words, swap for a maintained list or moderation API if abuse shows up.
const BLOCKED_WORDS = new Set([
	"anal",
	"asshole",
	"bastard",
	"bitch",
	"blowjob",
	"cock",
	"cunt",
	"dick",
	"dildo",
	"fag",
	"faggot",
	"fuck",
	"fucking",
	"hitler",
	"kike",
	"motherfucker",
	"nazi",
	"nigga",
	"nigger",
	"penis",
	"porn",
	"pussy",
	"rape",
	"retard",
	"shit",
	"slut",
	"tranny",
	"vagina",
	"whore",
]);

/** Collapses whitespace so "  Rock   climbing " and "Rock climbing" are one label. */
export function cleanCustomInterestLabel(label: string): string {
	return label.trim().replace(/\s+/g, " ");
}

/** Dedupe key: case- and whitespace-insensitive. */
export function customInterestKey(label: string): string {
	return cleanCustomInterestLabel(label).toLowerCase();
}

/** Undoes common leetspeak so "sh1t" is caught as "shit". */
function deLeet(value: string): string {
	return value.replace(
		/[013457@$]/g,
		(char) => ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" })[char] ?? char,
	);
}

export function containsBlockedWord(label: string): boolean {
	const words = deLeet(customInterestKey(label)).split(/[^\p{L}]+/u);

	return words.some((word) => BLOCKED_WORDS.has(word));
}

/** Returns a reason when the label can't be saved, otherwise null. */
export function customInterestError(label: string): string | null {
	const cleaned = cleanCustomInterestLabel(label);

	if (cleaned.length < CUSTOM_INTEREST_MIN_LENGTH || cleaned.length > CUSTOM_INTEREST_MAX_LENGTH) {
		return `Interests must be ${CUSTOM_INTEREST_MIN_LENGTH}–${CUSTOM_INTEREST_MAX_LENGTH} characters.`;
	}

	if (!/\p{L}/u.test(cleaned)) {
		return "Interests need at least one letter.";
	}

	if (containsBlockedWord(cleaned)) {
		return "That interest isn't allowed.";
	}

	return null;
}

/** Cleans and dedupes a submitted list, keeping the first spelling of each label. */
export function dedupeCustomInterests(labels: readonly string[]): string[] {
	const seen = new Map<string, string>();

	for (const label of labels) {
		const key = customInterestKey(label);

		if (!seen.has(key)) {
			seen.set(key, cleanCustomInterestLabel(label));
		}
	}

	return [...seen.values()];
}

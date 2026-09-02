/** Minimum age required to use Haven. Enforced here as well as in the app. */
export const MIN_AGE = 18;

/** Sanity ceiling so obvious typos, like a year in the 1800s, are rejected. */
export const MAX_AGE = 120;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `YYYY-MM-DD` calendar date in UTC, matching the `birth_date` column format.
 * Returns null for malformed input and for values `Date` would silently roll forward,
 * such as `2001-02-30`.
 */
export function parseIsoDate(value: string): Date | null {
	if (!ISO_DATE_PATTERN.test(value)) {
		return null;
	}

	const [year, month, day] = value.split("-").map(Number);
	const parsed = new Date(Date.UTC(year, month - 1, day));

	const isRealDate =
		parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;

	return isRealDate ? parsed : null;
}

/** Whole years elapsed since `birthDate`, counting the birthday itself. */
export function ageFromBirthDate(birthDate: Date, today: Date = new Date()): number {
	const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
	const beforeBirthday = monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate());

	return today.getUTCFullYear() - birthDate.getUTCFullYear() - (beforeBirthday ? 1 : 0);
}

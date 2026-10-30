import { ageFromBirthDate } from "@/lib/profile/age";

/** Highest age a user can pick as the upper bound of their range. */
export const PREF_AGE_MAX = 99;

/** `gender` codes: 0 = female, 1 = male, 2 = non-binary. */
export const GENDER_MAX = 2;

export type PartnerFilterProfile = {
	gender: number | null;
	birthDate: Date | null;
	/** Null or empty = open to every gender. */
	interestedIn: readonly number[] | null;
	prefAgeMin: number | null;
	prefAgeMax: number | null;
};

/**
 * Whether `candidate` passes `viewer`'s own filters. Unknown candidate data passes,
 * so missing values never hide someone (same rule as the scoring neutrals).
 */
export function passesFilters(viewer: PartnerFilterProfile, candidate: PartnerFilterProfile, today = new Date()) {
	const genders = viewer.interestedIn;

	if (genders && genders.length > 0 && candidate.gender != null && !genders.includes(candidate.gender)) {
		return false;
	}

	if (candidate.birthDate == null) {
		return true;
	}

	const age = ageFromBirthDate(candidate.birthDate, today);

	return (
		(viewer.prefAgeMin == null || age >= viewer.prefAgeMin) && (viewer.prefAgeMax == null || age <= viewer.prefAgeMax)
	);
}

/** Reciprocal check: each side fits what the other wants. Mirrors the SQL in `poolConditions`. */
export function mutualFilterMatch(a: PartnerFilterProfile, b: PartnerFilterProfile, today = new Date()) {
	return passesFilters(a, b, today) && passesFilters(b, a, today);
}

/** `YYYY-MM-DD` in UTC, matching the `birth_date` column. */
function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/**
 * Birth-date window for an inclusive age range, for SQL filtering.
 * Age ≥ min ⇔ born on or before `latest`; age ≤ max ⇔ born after `earliestExclusive`.
 */
export function birthDateWindow(minAge: number | null, maxAge: number | null, today = new Date()) {
	const shift = (years: number) =>
		isoDate(new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate())));

	return {
		latest: minAge == null ? null : shift(minAge),
		earliestExclusive: maxAge == null ? null : shift(maxAge + 1),
	};
}

export function isValidAgeRange(min: number | null | undefined, max: number | null | undefined): boolean {
	return min == null || max == null || min <= max;
}

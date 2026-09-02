/**
 * Date-of-birth parsing for the onboarding age gate. The API enforces the same rules on
 * `birth_date`, so this exists to give immediate feedback rather than to be the only check.
 */

/** Minimum age required to use Haven. */
export const MIN_AGE = 18;

/** Sanity ceiling so an obviously mistyped year is caught before submitting. */
export const MAX_AGE = 120;

/** The three inputs of the date field, kept as strings while the user is typing. */
export type DateOfBirthParts = {
	day: string;
	month: string;
	year: string;
};

export const emptyDateOfBirth: DateOfBirthParts = { day: "", month: "", year: "" };

export type DateOfBirthResult =
	| { status: "incomplete" }
	| { status: "invalid" }
	| { status: "unrealistic" }
	| { status: "underage"; age: number }
	| { status: "valid"; isoDate: string; age: number };

function pad(value: number, length: number): string {
	return String(value).padStart(length, "0");
}

/**
 * Whole years elapsed since the given date, counting the birthday itself. Computed in UTC
 * to match the API, so client and server never disagree on a borderline birthday.
 */
function ageFrom(year: number, month: number, day: number, today: Date): number {
	const monthDelta = today.getUTCMonth() + 1 - month;
	const beforeBirthday = monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < day);

	return today.getUTCFullYear() - year - (beforeBirthday ? 1 : 0);
}

/**
 * Classifies the current input so the screen can decide between an inline message and the
 * blocking under-18 alert.
 */
export function evaluateDateOfBirth(parts: DateOfBirthParts, today: Date = new Date()): DateOfBirthResult {
	const { day, month, year } = parts;

	if (day.length === 0 || month.length === 0 || year.length !== 4) {
		return { status: "incomplete" };
	}

	const dayNumber = Number(day);
	const monthNumber = Number(month);
	const yearNumber = Number(year);

	// Rejects both out-of-range values and overflow like 31 February, which `Date` would
	// otherwise roll forward into the next month.
	const candidate = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
	const isRealDate =
		monthNumber >= 1 &&
		monthNumber <= 12 &&
		dayNumber >= 1 &&
		candidate.getUTCFullYear() === yearNumber &&
		candidate.getUTCMonth() === monthNumber - 1 &&
		candidate.getUTCDate() === dayNumber;

	if (!isRealDate) {
		return { status: "invalid" };
	}

	const age = ageFrom(yearNumber, monthNumber, dayNumber, today);

	if (age < 0 || age > MAX_AGE) {
		return { status: "unrealistic" };
	}

	if (age < MIN_AGE) {
		return { status: "underage", age };
	}

	return {
		status: "valid",
		isoDate: `${pad(yearNumber, 4)}-${pad(monthNumber, 2)}-${pad(dayNumber, 2)}`,
		age,
	};
}

/** Splits a stored `YYYY-MM-DD` value back into field values when returning to the step. */
export function splitIsoDate(isoDate: string | undefined): DateOfBirthParts {
	if (!isoDate) {
		return emptyDateOfBirth;
	}

	const [year, month, day] = isoDate.split("-");

	return { day: day ?? "", month: month ?? "", year: year ?? "" };
}

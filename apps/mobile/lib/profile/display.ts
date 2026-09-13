import {
	EthnicityOptions,
	GenderOptions,
	INTEREST_SELECTED,
	InterestFields,
	LookingFor,
	LookingForOptions,
	type LookingForValue,
	lookingForFromGoal,
	SelfDimensions,
} from "@/constants/profile-taxonomy";
import type { ProfileRecord } from "@/lib/api/profile";

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Whole years since a `YYYY-MM-DD` birth date, matching the API age helper. */
export function ageFromBirthDateString(birthDate: string, today: Date = new Date()): number | undefined {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);

	if (!match) {
		return undefined;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));

	if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
		return undefined;
	}

	const monthDelta = today.getUTCMonth() - parsed.getUTCMonth();
	const beforeBirthday = monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < parsed.getUTCDate());

	return today.getUTCFullYear() - parsed.getUTCFullYear() - (beforeBirthday ? 1 : 0);
}

export function profileGenderLabel(profile: ProfileRecord): string | undefined {
	const gender = readNumber(profile.gender);

	return GenderOptions.find((option) => option.value === gender)?.label;
}

export function profileEthnicityLabel(profile: ProfileRecord): string | undefined {
	const ethnicity = readString(profile.ethnicity);

	if (!ethnicity) {
		return undefined;
	}

	return EthnicityOptions.find((option) => option.value === ethnicity)?.label ?? ethnicity;
}

export function profileLookingFor(profile: ProfileRecord): LookingForValue | undefined {
	const lookingFor = readNumber(profile.lookingFor);

	if (lookingFor === LookingFor.friends || lookingFor === LookingFor.dating) {
		return lookingFor;
	}

	const goal = readString(profile.goal);

	return goal ? lookingForFromGoal(goal) : undefined;
}

export function profileLookingForLabel(profile: ProfileRecord): string | undefined {
	const lookingFor = profileLookingFor(profile);

	if (lookingFor === undefined) {
		return undefined;
	}

	return LookingForOptions.find((option) => option.value === lookingFor)?.badge;
}

export function profileAge(profile: ProfileRecord): number | undefined {
	const birthDate = readString(profile.birthDate);

	if (!birthDate) {
		return undefined;
	}

	return ageFromBirthDateString(birthDate);
}

/** Vague age band for public profile cards, matching the API helper. */
export function profileAgeLabel(profile: ProfileRecord): string | undefined {
	const age = profileAge(profile);

	if (age === undefined) {
		return undefined;
	}

	if (age < 20) {
		return "late teens";
	}

	if (age < 25) {
		return "early 20s";
	}

	if (age < 30) {
		return "mid-20s";
	}

	if (age < 35) {
		return "early 30s";
	}

	if (age < 40) {
		return "late 30s";
	}

	return String(age);
}

export function profileSelectedInterests(profile: ProfileRecord): string[] {
	return InterestFields.filter((field) => profile[field.key] === INTEREST_SELECTED).map((field) => field.label);
}

export function profileSelfRatings(profile: ProfileRecord): { label: string; value: number }[] {
	return SelfDimensions.flatMap((dimension) => {
		const value = readNumber(profile[dimension.selfKey]);

		return value === undefined ? [] : [{ label: dimension.label, value }];
	});
}

export function profileInitials(name: string | undefined): string {
	const trimmed = name?.trim();

	if (!trimmed) {
		return "?";
	}

	return trimmed
		.split(/\s+/)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

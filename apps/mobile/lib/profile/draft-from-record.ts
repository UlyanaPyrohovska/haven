import {
	EthnicityOptions,
	type EthnicityValue,
	type GenderValue,
	type GoalValue,
	IMPORTANCE_MAX,
	IMPORTANCE_MIN,
	INTEREST_SELECTED,
	InterestFields,
	type InterestKey,
	LookingFor,
	type LookingForValue,
	lookingForFromGoal,
	type PrefKey,
	ProfileGoalOptions,
	SelfDimensions,
	type SelfKey,
	TraitDimensions,
} from "@/constants/profile-taxonomy";
import type { ProfileRecord } from "@/lib/api/profile";
import type { ProfileDraft } from "@/lib/onboarding/profile-draft";
import { readPrivacySettings } from "@/lib/profile/privacy";

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readGender(value: unknown): GenderValue | undefined {
	const gender = readNumber(value);

	return gender === 0 || gender === 1 ? gender : undefined;
}

function readEthnicity(value: unknown): EthnicityValue | undefined {
	const ethnicity = readString(value);

	if (!ethnicity) {
		return undefined;
	}

	return EthnicityOptions.some((option) => option.value === ethnicity) ? (ethnicity as EthnicityValue) : undefined;
}

function readGoal(value: unknown): GoalValue | undefined {
	const goal = readString(value);

	if (!goal) {
		return undefined;
	}

	return (ProfileGoalOptions as readonly string[]).includes(goal) ? (goal as GoalValue) : undefined;
}

function readLookingFor(record: ProfileRecord, goal: GoalValue | undefined): LookingForValue | undefined {
	const lookingFor = readNumber(record.lookingFor);

	if (lookingFor === LookingFor.friends || lookingFor === LookingFor.dating) {
		return lookingFor;
	}

	return goal ? lookingForFromGoal(goal) : undefined;
}

function readInterests(record: ProfileRecord): InterestKey[] {
	return InterestFields.filter((field) => record[field.key] === INTEREST_SELECTED).map((field) => field.key);
}

/** Approximate slider values from the normalised `pref_*` shares stored in the database. */
function readPartnerImportance(record: ProfileRecord): Partial<Record<PrefKey, number>> {
	const weights = TraitDimensions.map((dimension) => readNumber(record[dimension.prefKey]) ?? 0);
	const max = Math.max(...weights, 1);

	return Object.fromEntries(
		TraitDimensions.map((dimension) => {
			const weight = readNumber(record[dimension.prefKey]) ?? 0;
			const scaled = Math.round((weight / max) * IMPORTANCE_MAX);

			return [dimension.prefKey, Math.max(IMPORTANCE_MIN, scaled)] as const;
		}),
	) as Partial<Record<PrefKey, number>>;
}

function readSelfRatings(record: ProfileRecord): Partial<Record<SelfKey, number>> {
	return Object.fromEntries(
		SelfDimensions.flatMap((dimension) => {
			const value = readNumber(record[dimension.selfKey]);

			return value === undefined ? [] : [[dimension.selfKey, value] as const];
		}),
	) as Partial<Record<SelfKey, number>>;
}

/** Hydrates an in-memory draft from a saved profile row for the edit flow. */
export function profileRecordToDraft(record: ProfileRecord): ProfileDraft {
	const goal = readGoal(record.goal);

	return {
		birthDate: readString(record.birthDate),
		gender: readGender(record.gender),
		ethnicity: readEthnicity(record.ethnicity),
		lookingFor: readLookingFor(record, goal),
		career: readString(record.career) ?? "",
		goal,
		bio: readString(record.bio) ?? "",
		interests: readInterests(record),
		partner: readPartnerImportance(record),
		self: readSelfRatings(record),
		privacy: readPrivacySettings(record),
	};
}

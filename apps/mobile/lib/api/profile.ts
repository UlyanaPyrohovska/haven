import {
	AGE_FILTER_MAX,
	AGE_FILTER_MIN,
	GenderOptions,
	type GenderValue,
	INTEREST_SELECTED,
	INTEREST_UNSELECTED,
	InterestFields,
	PARTNER_BUDGET,
	type PrefKey,
	TraitDimensions,
} from "@/constants/profile-taxonomy";
import { apiFetch } from "@/lib/api/client";
import type { ProfileDraft } from "@/lib/onboarding/profile-draft";
import { buildHiddenLocationPayload } from "@/lib/profile/location";
import { PRIVACY_KEYS } from "@/lib/profile/privacy";

/** Request body for `PATCH /me`; keys match the `user_profiles` column names. */
export type ProfilePayload = Record<string, number | string | boolean | string[] | number[] | null>;

export type ProfileRecord = Record<string, unknown>;

/**
 * Turns the 1–10 importance sliders into the 100-point `pref_*` split that the schema and
 * the seed dataset use. Shares are left unrounded so they sum to exactly the budget.
 */
function normalisePartnerImportance(importance: Partial<Record<PrefKey, number>>): Record<PrefKey, number> {
	const total = TraitDimensions.reduce((sum, dimension) => sum + (importance[dimension.prefKey] ?? 0), 0);

	// Only reachable if the step is somehow skipped; an even split keeps the row valid
	// without inventing a preference.
	const shares = TraitDimensions.map((dimension) => {
		const weight = total > 0 ? (importance[dimension.prefKey] ?? 0) / total : 1 / TraitDimensions.length;

		return [dimension.prefKey, weight * PARTNER_BUDGET] as const;
	});

	return Object.fromEntries(shares) as Record<PrefKey, number>;
}

/** Picking every gender or the full age span is stored as "no filter" (null). */
export function buildPartnerFiltersPayload(
	interestedIn: readonly GenderValue[],
	ageRange: { min: number; max: number } | undefined,
) {
	const allGenders = GenderOptions.every((option) => interestedIn.includes(option.value));

	return {
		interestedIn: interestedIn.length === 0 || allGenders ? null : [...interestedIn],
		prefAgeMin: ageRange && ageRange.min > AGE_FILTER_MIN ? ageRange.min : null,
		prefAgeMax: ageRange && ageRange.max < AGE_FILTER_MAX ? ageRange.max : null,
	};
}

export function buildProfilePayload(draft: ProfileDraft): ProfilePayload {
	const payload: ProfilePayload = {
		birthDate: draft.birthDate ?? null,
		gender: draft.gender ?? null,
		ethnicity: draft.ethnicity ?? null,
		lookingFor: draft.lookingFor ?? null,
		career: draft.career.trim() || null,
		goal: draft.goal ?? null,
		bio: draft.bio.trim() || null,
	};

	// Every interest column is written so the vectors stay dense: picked interests get the
	// top of the Likert range, the rest get the bottom.
	for (const field of InterestFields) {
		payload[field.key] = draft.interests.includes(field.key) ? INTEREST_SELECTED : INTEREST_UNSELECTED;
	}

	payload.customInterests = draft.customInterests;

	const partnerShares = normalisePartnerImportance(draft.partner);

	for (const dimension of TraitDimensions) {
		payload[dimension.prefKey] = partnerShares[dimension.prefKey];
		payload[dimension.selfKey] = dimension.selfRated ? (draft.self[dimension.selfKey] ?? null) : null;
	}

	Object.assign(payload, buildPartnerFiltersPayload(draft.interestedIn, draft.ageRange));

	for (const key of PRIVACY_KEYS) {
		payload[key] = draft.privacy[key];
	}

	const { location } = draft;
	payload.shareLocation = location.shareLocation;
	payload.shareCrossPaths = location.shareCrossPaths;

	if (location.preset === "hidden") {
		Object.assign(payload, buildHiddenLocationPayload());
	} else if (location.preset === "device" && location.latitude !== null && location.longitude !== null) {
		Object.assign(payload, {
			locationHidden: false,
			displayLocation: location.displayLocation,
			latitude: location.latitude,
			longitude: location.longitude,
		});
	}

	return payload;
}

/** Resolves to null when the user has signed up but not completed onboarding. */
export async function fetchProfile(): Promise<ProfileRecord | null> {
	const response = await apiFetch("/me");

	if (!response.ok) {
		throw new Error(`Failed to load profile (${response.status})`);
	}

	const body = (await response.json()) as { profile: ProfileRecord | null };

	return body.profile;
}

export async function saveProfile(draft: ProfileDraft): Promise<void> {
	const response = await apiFetch("/me", {
		method: "PATCH",
		body: JSON.stringify(buildProfilePayload(draft)),
	});

	if (!response.ok) {
		throw new Error(`Failed to save profile (${response.status})`);
	}
}

export async function saveProfileSettings(
	updates: Partial<Record<string, boolean | string | number | number[] | null>>,
): Promise<ProfileRecord | null> {
	const response = await apiFetch("/me", {
		method: "PATCH",
		body: JSON.stringify(updates),
	});

	if (!response.ok) {
		throw new Error(`Failed to save privacy settings (${response.status})`);
	}

	const body = (await response.json()) as { profile: ProfileRecord | null };

	return body.profile;
}

/** Permanently deletes the signed-in user's account and all of its data. */
export async function deleteAccount(): Promise<void> {
	const response = await apiFetch("/me", { method: "DELETE" });

	if (!response.ok) {
		throw new Error(`Failed to delete account (${response.status})`);
	}
}

import {
	INTEREST_SELECTED,
	INTEREST_UNSELECTED,
	InterestFields,
	PARTNER_BUDGET,
	type PrefKey,
	TraitDimensions,
} from "@/constants/profile-taxonomy";
import { apiFetch } from "@/lib/api/client";
import type { ProfileDraft } from "@/lib/onboarding/profile-draft";

/** Request body for `PATCH /me`; keys match the `user_profiles` column names. */
export type ProfilePayload = Record<string, number | string | null>;

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

export function buildProfilePayload(draft: ProfileDraft): ProfilePayload {
	const payload: ProfilePayload = {
		birthDate: draft.birthDate ?? null,
		gender: draft.gender ?? null,
		career: draft.career.trim() || null,
		goal: draft.goal ?? null,
		bio: draft.bio.trim() || null,
	};

	// Every interest column is written so the vectors stay dense: picked interests get the
	// top of the Likert range, the rest get the bottom.
	for (const field of InterestFields) {
		payload[field.key] = draft.interests.includes(field.key) ? INTEREST_SELECTED : INTEREST_UNSELECTED;
	}

	const partnerShares = normalisePartnerImportance(draft.partner);

	for (const dimension of TraitDimensions) {
		payload[dimension.prefKey] = partnerShares[dimension.prefKey];
		payload[dimension.selfKey] = dimension.selfRated ? (draft.self[dimension.selfKey] ?? null) : null;
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

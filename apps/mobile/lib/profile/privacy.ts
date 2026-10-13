import { INTEREST_SELECTED, INTEREST_UNSELECTED, InterestFields } from "@/constants/profile-taxonomy";
import type { ProfileRecord } from "@/lib/api/profile";
import type { ProfileDraft } from "@/lib/onboarding/profile-draft";
import { profileAgeLabel, profileSelectedInterests } from "@/lib/profile/display";

export type PrivacySettings = {
	discoverable: boolean;
	showAge: boolean;
	showCareer: boolean;
	showBio: boolean;
	showInterests: boolean;
};

export type PrivacyKey = keyof PrivacySettings;

export const PRIVACY_KEYS: PrivacyKey[] = ["discoverable", "showAge", "showCareer", "showBio", "showInterests"];

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
	discoverable: true,
	showAge: true,
	showCareer: true,
	showBio: true,
	showInterests: true,
};

function readFlag(profile: ProfileRecord, key: PrivacyKey): boolean {
	return profile[key] !== false;
}

export function readPrivacySettings(profile: ProfileRecord | null | undefined): PrivacySettings {
	return {
		discoverable: readFlag(profile ?? {}, "discoverable"),
		showAge: readFlag(profile ?? {}, "showAge"),
		showCareer: readFlag(profile ?? {}, "showCareer"),
		showBio: readFlag(profile ?? {}, "showBio"),
		showInterests: readFlag(profile ?? {}, "showInterests"),
	};
}

export function publicProfilePreview(profile: ProfileRecord) {
	const privacy = readPrivacySettings(profile);
	const ageLabel = privacy.showAge ? profileAgeLabel(profile) : undefined;
	const career = privacy.showCareer && typeof profile.career === "string" ? profile.career.trim() : undefined;
	const bio = privacy.showBio && typeof profile.bio === "string" ? profile.bio.trim() : undefined;
	const interests = privacy.showInterests ? profileSelectedInterests(profile) : [];

	return { ageLabel, career, bio, interests };
}

/** Builds a profile-shaped record from onboarding draft answers for preview helpers. */
export function draftToPreviewRecord(draft: ProfileDraft): ProfileRecord {
	const record: ProfileRecord = {
		birthDate: draft.birthDate,
		career: draft.career.trim() || undefined,
		bio: draft.bio.trim() || undefined,
	};

	for (const field of InterestFields) {
		record[field.key] = draft.interests.includes(field.key) ? INTEREST_SELECTED : INTEREST_UNSELECTED;
	}

	for (const key of PRIVACY_KEYS) {
		record[key] = draft.privacy[key];
	}

	return record;
}

export function draftPublicProfilePreview(draft: ProfileDraft) {
	return publicProfilePreview(draftToPreviewRecord(draft));
}

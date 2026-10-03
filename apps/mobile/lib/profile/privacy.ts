import type { ProfileRecord } from "@/lib/api/profile";
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

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import type {
	EthnicityValue,
	GenderValue,
	GoalValue,
	InterestKey,
	LookingForValue,
	PrefKey,
	SelfKey,
} from "@/constants/profile-taxonomy";
import type { LocationPresetId } from "@/lib/profile/location";
import { DEFAULT_PRIVACY_SETTINGS, type PrivacyKey } from "@/lib/profile/privacy";

/** Mirrors the `user_profiles` columns the onboarding flow collects. */
export type ProfileDraft = {
	/** `YYYY-MM-DD`, matching the `birth_date` column. Age is derived, never stored. */
	birthDate: string | undefined;
	gender: GenderValue | undefined;
	ethnicity: EthnicityValue | undefined;
	lookingFor: LookingForValue | undefined;
	career: string;
	goal: GoalValue | undefined;
	bio: string;
	/** Picked interests; everything not listed is submitted as "not interested". */
	interests: InterestKey[];
	/** Labels from the shared `custom_interests` catalog. */
	customInterests: string[];
	/** Importance on a 1–10 scale, normalised into the 100-point `pref_*` split on submit. */
	partner: Partial<Record<PrefKey, number>>;
	/** "Show me" filter; every option selected means open to everyone. */
	interestedIn: GenderValue[];
	/** Undefined until the user sees the partner step; `max` at `AGE_FILTER_MAX` means no upper limit. */
	ageRange: { min: number; max: number } | undefined;
	self: Partial<Record<SelfKey, number>>;
	privacy: typeof DEFAULT_PRIVACY_SETTINGS;
	/** Optional JPEG data URL; uploaded to Better Auth `user.image` on submit, null when skipped. */
	photo: string | null;
	/** Unset preset leaves location columns untouched; coordinates are only filled for "device". */
	location: {
		preset: LocationPresetId | undefined;
		displayLocation: string | null;
		latitude: number | null;
		longitude: number | null;
		shareLocation: boolean;
		shareCrossPaths: boolean;
	};
};

const emptyDraft: ProfileDraft = {
	birthDate: undefined,
	gender: undefined,
	ethnicity: undefined,
	lookingFor: undefined,
	career: "",
	goal: undefined,
	bio: "",
	interests: [],
	customInterests: [],
	partner: {},
	interestedIn: [],
	ageRange: undefined,
	self: {},
	privacy: { ...DEFAULT_PRIVACY_SETTINGS },
	photo: null,
	location: {
		preset: undefined,
		displayLocation: null,
		latitude: null,
		longitude: null,
		shareLocation: true,
		shareCrossPaths: true,
	},
};

type ProfileDraftContextValue = {
	draft: ProfileDraft;
	updateDraft: (partial: Partial<ProfileDraft>) => void;
	toggleInterest: (key: InterestKey) => void;
	setPartnerImportance: (key: PrefKey, value: number) => void;
	setSelfRating: (key: SelfKey, value: number) => void;
	setPrivacySetting: (key: PrivacyKey, value: boolean) => void;
	reset: () => void;
};

const ProfileDraftContext = createContext<ProfileDraftContextValue | undefined>(undefined);

/**
 * Holds onboarding answers in memory for the duration of the flow. Nothing is persisted
 * until the final step submits, so an interrupted signup restarts the questionnaire.
 */
export function ProfileDraftProvider({ children }: { children: ReactNode }) {
	const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);

	const updateDraft = useCallback((partial: Partial<ProfileDraft>) => {
		setDraft((current) => ({ ...current, ...partial }));
	}, []);

	const toggleInterest = useCallback((key: InterestKey) => {
		setDraft((current) => ({
			...current,
			interests: current.interests.includes(key)
				? current.interests.filter((interest) => interest !== key)
				: [...current.interests, key],
		}));
	}, []);

	const setPartnerImportance = useCallback((key: PrefKey, value: number) => {
		setDraft((current) => ({ ...current, partner: { ...current.partner, [key]: value } }));
	}, []);

	const setSelfRating = useCallback((key: SelfKey, value: number) => {
		setDraft((current) => ({ ...current, self: { ...current.self, [key]: value } }));
	}, []);

	const setPrivacySetting = useCallback((key: PrivacyKey, value: boolean) => {
		setDraft((current) => ({ ...current, privacy: { ...current.privacy, [key]: value } }));
	}, []);

	const reset = useCallback(() => {
		setDraft(emptyDraft);
	}, []);

	const value = useMemo(
		() => ({ draft, updateDraft, toggleInterest, setPartnerImportance, setSelfRating, setPrivacySetting, reset }),
		[draft, updateDraft, toggleInterest, setPartnerImportance, setSelfRating, setPrivacySetting, reset],
	);

	return <ProfileDraftContext.Provider value={value}>{children}</ProfileDraftContext.Provider>;
}

export function useProfileDraft(): ProfileDraftContextValue {
	const context = useContext(ProfileDraftContext);

	if (!context) {
		throw new Error("useProfileDraft must be used inside a ProfileDraftProvider");
	}

	return context;
}

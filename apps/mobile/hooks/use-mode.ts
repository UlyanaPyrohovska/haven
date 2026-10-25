import { useQuery } from "@tanstack/react-query";

import type { AppMode } from "@/constants/app-config";
import { LookingFor } from "@/constants/profile-taxonomy";
import { profileQueryKey } from "@/hooks/use-profile";
import { fetchProfile } from "@/lib/api/profile";

export function modeFromLookingFor(lookingFor: unknown): AppMode | null {
	if (lookingFor === LookingFor.dating) return "dating";
	if (lookingFor === LookingFor.friends) return "friends";
	return null;
}

/** Signed-in user's matching mode from the cached profile; null before onboarding or when signed out. */
export function useMode(): AppMode | null {
	// Cache-only observer: screens that need the profile fetch it; this just follows the cache.
	const { data } = useQuery({ queryKey: profileQueryKey, queryFn: fetchProfile, enabled: false });

	return modeFromLookingFor(data?.lookingFor);
}

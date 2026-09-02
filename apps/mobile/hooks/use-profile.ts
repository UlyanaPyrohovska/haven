import { useQuery } from "@tanstack/react-query";

import { fetchProfile } from "@/lib/api/profile";

export const profileQueryKey = ["profile"] as const;

/** Reads the signed-in user's profile; `data === null` means onboarding is still pending. */
export function useProfileQuery(enabled: boolean) {
	return useQuery({
		queryKey: profileQueryKey,
		queryFn: fetchProfile,
		enabled,
		retry: 1,
	});
}

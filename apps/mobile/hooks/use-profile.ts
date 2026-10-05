import { type QueryClient, useQuery } from "@tanstack/react-query";

import { fetchProfile, type ProfileRecord } from "@/lib/api/profile";

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

export function mergeProfileCache(
	queryClient: QueryClient,
	updates: Partial<ProfileRecord>,
	serverProfile?: ProfileRecord | null,
) {
	queryClient.setQueryData<ProfileRecord | null>(profileQueryKey, (current) => {
		if (serverProfile) {
			return serverProfile;
		}

		if (current && typeof current === "object") {
			return { ...current, ...updates };
		}

		return current ?? null;
	});
}

export function refreshProfileCache(queryClient: QueryClient) {
	void queryClient.invalidateQueries({ queryKey: profileQueryKey });
}

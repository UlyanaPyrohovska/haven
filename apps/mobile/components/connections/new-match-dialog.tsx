import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useIsFocused, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useTranslation } from "react-i18next";

import { MatchCelebration } from "@/components/connections/match-celebration";
import { useMode } from "@/hooks/use-mode";
import type { MatchSummary } from "@/lib/api/recommendations";

const STORAGE_KEY = "haven.seenMatchIds";
const seenMatchIdsQueryKey = ["seenMatchIds"] as const;

async function readSeenIds(): Promise<Set<number>> {
	try {
		const raw = await SecureStore.getItemAsync(STORAGE_KEY);

		return new Set(raw ? (JSON.parse(raw) as number[]) : []);
	} catch {
		return new Set();
	}
}

/** Marks matches as announced for every mounted dialog, so home and matches never both show one. */
export function markMatchesSeen(queryClient: QueryClient, candidateIds: number[]) {
	const ids = new Set([...(queryClient.getQueryData<Set<number>>(seenMatchIdsQueryKey) ?? []), ...candidateIds]);

	queryClient.setQueryData(seenMatchIdsQueryKey, ids);
	void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify([...ids]));
}

/**
 * Announces a match made while the user was away (agents answer likes on the simulation tick).
 * Shows the newest unseen match on the focused screen only; closing it marks every current match as seen.
 *
 * shortcut: seen ids live on the device (not per account) and SecureStore values over ~2 KB
 * (~350 ids) may fail to save; move "seen" to the API if accounts share devices or matches grow.
 */
export function NewMatchDialog({ matches }: { matches: MatchSummary[] | undefined }) {
	const { t } = useTranslation();
	const router = useRouter();
	const mode = useMode();
	const queryClient = useQueryClient();
	const isFocused = useIsFocused();
	const { data: seen } = useQuery({ queryKey: seenMatchIdsQueryKey, queryFn: readSeenIds, staleTime: Infinity });

	const fresh =
		seen && matches
			? matches
					.filter((match) => !seen.has(match.candidateId))
					.sort((a, b) => b.matchedAt.localeCompare(a.matchedAt))[0]
			: undefined;

	const markAllSeen = () =>
		markMatchesSeen(
			queryClient,
			(matches ?? []).map((match) => match.candidateId),
		);

	return (
		<MatchCelebration
			visible={isFocused && fresh != null}
			name={fresh?.displayName ?? ""}
			photoUrl={fresh?.photoUrl}
			title={t("matches.newMatchTitle", { context: mode ?? undefined })}
			message={t("matches.newMatchMessage", { name: fresh?.displayName ?? "", context: mode ?? undefined })}
			confirmLabel={t("matches.sendMessage")}
			onConfirm={() => {
				markAllSeen();
				if (fresh) router.push(`/matches/${fresh.candidateId}` as Href);
			}}
			cancelLabel={t("matches.later")}
			onCancel={markAllSeen}
		/>
	);
}

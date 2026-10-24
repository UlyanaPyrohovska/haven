import { type Href, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Dialog } from "@/components/ui/dialog";
import type { MatchSummary } from "@/lib/api/recommendations";

const STORAGE_KEY = "haven.seenMatchIds";

async function readSeenIds(): Promise<Set<number>> {
	try {
		const raw = await SecureStore.getItemAsync(STORAGE_KEY);

		return new Set(raw ? (JSON.parse(raw) as number[]) : []);
	} catch {
		return new Set();
	}
}

/**
 * Announces a match made while the user was away (agents answer likes on the simulation tick).
 * Shows the newest unseen match; closing it marks every current match as seen.
 *
 * shortcut: seen ids live on the device (not per account) and SecureStore values over ~2 KB
 * (~350 ids) may fail to save; move "seen" to the API if accounts share devices or matches grow.
 */
export function NewMatchDialog({ matches }: { matches: MatchSummary[] | undefined }) {
	const { t } = useTranslation();
	const router = useRouter();
	const [seen, setSeen] = useState<Set<number> | null>(null);

	useEffect(() => {
		void readSeenIds().then(setSeen);
	}, []);

	const fresh =
		seen && matches
			? matches
					.filter((match) => !seen.has(match.candidateId))
					.sort((a, b) => b.matchedAt.localeCompare(a.matchedAt))[0]
			: undefined;

	const markAllSeen = () => {
		const ids = new Set([...(seen ?? []), ...(matches ?? []).map((match) => match.candidateId)]);

		setSeen(ids);
		void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify([...ids]));
	};

	return (
		<Dialog
			visible={fresh != null}
			icon="heart"
			title={t("matches.newMatchTitle")}
			message={t("matches.newMatchMessage", { name: fresh?.displayName ?? "" })}
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

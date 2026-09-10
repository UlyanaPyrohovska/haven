import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ConnectionCandidateScreen } from "@/components/connections/connection-candidate-screen";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { useTheme } from "@/hooks/use-theme";
import { fetchRecommendations, recommendationsQueryKey } from "@/lib/api/recommendations";

export default function ConnectionsIndexScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [candidateId, setCandidateId] = useState<number | null>(null);

	const recommendations = useQuery({
		queryKey: recommendationsQueryKey,
		queryFn: fetchRecommendations,
	});

	useEffect(() => {
		const first = recommendations.data?.recommendations[0];

		if (!first) {
			setCandidateId(null);
			return;
		}

		setCandidateId((current) => {
			const stillPending =
				current !== null &&
				recommendations.data?.recommendations.some((item) => item.candidateId === current);

			return stillPending ? current : first.candidateId;
		});
	}, [recommendations.data]);

	const onAdvance = useCallback(
		async (remainingCount: number) => {
			const refreshed = await queryClient.fetchQuery({
				queryKey: recommendationsQueryKey,
				queryFn: fetchRecommendations,
			});

			const next = refreshed.recommendations[0];

			if (next) {
				setCandidateId(next.candidateId);
				return;
			}

			setCandidateId(null);

			if (remainingCount === 0) {
				router.replace("/home" as Href);
			}
		},
		[queryClient, router],
	);

	if (recommendations.isPending) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	if (recommendations.isError) {
		return (
			<FormScreen title={t("connections.title")} showBack onBack={() => router.replace("/home")}>
				<ThemedText type="link" onPress={() => recommendations.refetch()}>
					{t("common.retry")}
				</ThemedText>
			</FormScreen>
		);
	}

	if (candidateId === null) {
		return (
			<FormScreen
				title={t("connections.emptyTitle")}
				subtitle={t("connections.emptySubtitle")}
				showBack
				onBack={() => router.replace("/home")}
			>
				<Button label={t("connections.backHome")} onPress={() => router.replace("/home")} />
			</FormScreen>
		);
	}

	return <ConnectionCandidateScreen key={candidateId} candidateId={candidateId} onAdvance={onAdvance} />;
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});

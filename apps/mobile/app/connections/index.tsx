import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "react-i18next";
import { fetchRecommendations, recommendationsQueryKey } from "@/lib/api/recommendations";

export default function ConnectionsIndexScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const recommendations = useQuery({
		queryKey: recommendationsQueryKey,
		queryFn: fetchRecommendations,
	});

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

	const first = recommendations.data.recommendations[0];

	if (!first) {
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

	return <Redirect href={`/connections/${first.candidateId}`} />;
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});

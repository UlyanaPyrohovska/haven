import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";
import { fetchRecommendations, recommendationsQueryKey } from "@/lib/api/recommendations";

const copy = Strings.connections;

export default function ConnectionsIndexScreen() {
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
			<FormScreen title={copy.title} showBack onBack={() => router.replace("/home")}>
				<ThemedText type="link" onPress={() => recommendations.refetch()}>
					{Strings.common.retry}
				</ThemedText>
			</FormScreen>
		);
	}

	const first = recommendations.data.recommendations[0];

	if (!first) {
		return (
			<FormScreen
				title={copy.emptyTitle}
				subtitle={copy.emptySubtitle}
				showBack
				onBack={() => router.replace("/home")}
			>
				<Button label={copy.backHome} onPress={() => router.replace("/home")} />
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

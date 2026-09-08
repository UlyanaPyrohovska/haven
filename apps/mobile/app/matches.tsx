import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";
import { fetchMatches, matchesQueryKey } from "@/lib/api/recommendations";

const copy = Strings.matches;

export default function MatchesScreen() {
	const router = useRouter();
	const theme = useTheme();
	const matches = useQuery({
		queryKey: matchesQueryKey,
		queryFn: fetchMatches,
	});

	if (matches.isPending) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	const rows = matches.data?.matches ?? [];

	return (
		<FormScreen
			title={copy.title}
			subtitle={copy.subtitle}
			showBack
			onBack={() => router.replace("/home")}
		>
			{rows.length === 0 ? (
				<ThemedText style={{ color: theme.muted, textAlign: "center" }}>{copy.empty}</ThemedText>
			) : (
				<MenuCard>
					{rows.map((match, index) => (
						<View key={match.candidateId}>
							<MenuRow
								label={match.displayName}
								subtitle={
									match.ageLabel
										? `${match.ageLabel} · ${match.topInterests.join(", ")}`
										: match.topInterests.join(", ")
								}
								onPress={() => router.push(`/connections/${match.candidateId}`)}
							/>
							{index < rows.length - 1 ? <MenuDivider /> : null}
						</View>
					))}
				</MenuCard>
			)}
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
});

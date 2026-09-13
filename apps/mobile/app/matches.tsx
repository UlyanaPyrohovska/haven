import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ProfileHeaderButton } from "@/components/profile/profile-header-button";
import { ThemedText } from "@/components/themed-text";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { useTheme } from "@/hooks/use-theme";
import { fetchMatches, matchesQueryKey } from "@/lib/api/recommendations";

export default function MatchesScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const matches = useQuery({
		queryKey: matchesQueryKey,
		queryFn: fetchMatches,
	});

	const rows = matches.data?.matches ?? [];

	return (
		<FormScreen
			title={t("matches.title")}
			subtitle={t("matches.subtitle")}
			showBack
			headerRight={<ProfileHeaderButton />}
		>
			{matches.isPending ? (
				<View style={styles.centered}>
					<ActivityIndicator color={theme.tint} />
				</View>
			) : null}
			{!matches.isPending && rows.length === 0 ? (
				<ThemedText style={{ color: theme.muted, textAlign: "center" }}>{t("matches.empty")}</ThemedText>
			) : !matches.isPending ? (
				<MenuCard>
					{rows.map((match, index) => (
						<View key={match.candidateId}>
							<MenuRow
								label={match.displayName}
								photoUrl={match.photoUrl}
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
			) : null}
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

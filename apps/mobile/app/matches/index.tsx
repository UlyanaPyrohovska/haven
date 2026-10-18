import { useQuery } from "@tanstack/react-query";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ConversationRow } from "@/components/chat/conversation-row";
import { ProfileHeaderButton } from "@/components/profile/profile-header-button";
import { ThemedText } from "@/components/themed-text";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider } from "@/components/ui/menu-row";
import { useTheme } from "@/hooks/use-theme";
import { fetchMatches, matchesQueryKey } from "@/lib/api/recommendations";

/** Inbox: every match with its last message, most recent activity first. */
export default function MatchesScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const matches = useQuery({
		queryKey: matchesQueryKey,
		queryFn: fetchMatches,
	});

	// Refresh previews when coming back from a thread.
	useFocusEffect(
		useCallback(() => {
			void matches.refetch();
		}, [matches.refetch]),
	);

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
			) : matches.isError ? (
				<ErrorBanner message={t("auth.errors.network")} />
			) : rows.length === 0 ? (
				<ThemedText style={{ color: theme.muted, textAlign: "center" }}>{t("matches.empty")}</ThemedText>
			) : (
				<MenuCard>
					{rows.map((match, index) => (
						<View key={match.candidateId}>
							<ConversationRow match={match} onPress={() => router.push(`/matches/${match.candidateId}` as Href)} />
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

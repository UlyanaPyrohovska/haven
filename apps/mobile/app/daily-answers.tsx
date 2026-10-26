import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { useMode } from "@/hooks/use-mode";
import { useTheme } from "@/hooks/use-theme";
import { fetchMatchAnswersToday, matchAnswersTodayQueryKey } from "@/lib/api/daily-question";

/** What the user's matches answered to today's question. */
export default function DailyAnswersScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const mode = useMode();
	const answers = useQuery({
		queryKey: matchAnswersTodayQueryKey,
		queryFn: fetchMatchAnswersToday,
	});

	const rows = answers.data?.answers ?? [];

	return (
		<FormScreen
			title={answers.data?.question ?? t("home.todaysQuestion")}
			subtitle={t("dailyAnswers.subtitle", { context: mode ?? undefined })}
			showBack
			onBack={() => router.back()}
		>
			{answers.isPending ? (
				<View style={styles.centered}>
					<ActivityIndicator color={theme.tint} />
				</View>
			) : answers.isError ? (
				<ErrorBanner message={t("auth.errors.network")} />
			) : answers.data.locked ? (
				<>
					<ThemedText style={[styles.empty, { color: theme.muted }]}>{t("dailyQuestion.lockedPrompt")}</ThemedText>
					<Button label={t("dailyQuestion.shareCTA")} onPress={() => router.push("/daily-question" as Href)} />
				</>
			) : rows.length === 0 ? (
				<ThemedText style={[styles.empty, { color: theme.muted }]}>
					{t("dailyAnswers.empty", { context: mode ?? undefined })}
				</ThemedText>
			) : (
				<MenuCard>
					{rows.map((row, index) => (
						<View key={row.candidateId}>
							<MenuRow
								label={row.displayName}
								subtitle={row.answer}
								photoUrl={row.photoUrl}
								onPress={() => router.push(`/matches/${row.candidateId}` as Href)}
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
	empty: {
		textAlign: "center",
	},
});

import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { FontSize, Radius, Spacing } from "@/constants/app-config";
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
				<View style={styles.feed}>
					{rows.map((row) => (
						<Pressable
							key={row.candidateId}
							accessibilityRole="button"
							onPress={() => router.push(`/matches/${row.candidateId}` as Href)}
							style={({ pressed }) => [
								styles.post,
								{ backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
							]}
						>
							<View style={styles.author}>
								<UserAvatar imageUrl={row.photoUrl} name={row.displayName} size={40} />
								<ThemedText type="label" style={styles.authorName} numberOfLines={1}>
									{row.displayName}
								</ThemedText>
								<Ionicons name="chevron-forward" size={18} color={theme.icon} />
							</View>
							<ThemedText style={[styles.body, { color: theme.text }]}>{row.answer}</ThemedText>
						</Pressable>
					))}
				</View>
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
	feed: {
		gap: Spacing.md,
	},
	post: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	author: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	authorName: {
		flex: 1,
	},
	body: {
		fontSize: FontSize.md,
		lineHeight: 24,
	},
});

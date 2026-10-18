import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { FontSize, Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { fetchTodayDailyQuestion, todayDailyQuestionQueryKey } from "@/lib/api/daily-question";

export function DailyQuestionCard() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();

	const todayQuestion = useQuery({
		queryKey: todayDailyQuestionQueryKey,
		queryFn: fetchTodayDailyQuestion,
	});

	const question = todayQuestion.data?.question;
	const answer = todayQuestion.data?.answer?.trim();
	const answered = Boolean(answer);
	const showLoading = todayQuestion.isLoading && !question;

	const openModal = () => router.push("/daily-question" as Href);

	return (
		<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
			<View style={styles.header}>
				<Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.tint} />
				<ThemedText type="caption" style={[styles.eyebrow, { color: theme.muted }]}>
					{t("home.todaysQuestion")}
				</ThemedText>
				{answered ? (
					<View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
						<Ionicons name="checkmark" size={12} color={theme.tint} />
						<ThemedText type="caption" style={[styles.badgeText, { color: theme.tint }]}>
							{t("dailyQuestion.answered")}
						</ThemedText>
					</View>
				) : null}
			</View>

			{showLoading ? (
				<ActivityIndicator color={theme.tint} />
			) : (
				<>
					<ThemedText type="subtitle" style={styles.question}>
						{question}
					</ThemedText>

					{answered ? (
						<>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t("dailyQuestion.editHint")}
								onPress={openModal}
								style={({ pressed }) => [
									styles.answer,
									{ backgroundColor: theme.accentSoft, borderColor: theme.tint, opacity: pressed ? 0.85 : 1 },
								]}
							>
								<ThemedText style={[styles.answerText, { color: theme.text }]}>{answer}</ThemedText>
								<Ionicons name="pencil" size={16} color={theme.muted} />
							</Pressable>
							<Pressable
								accessibilityRole="button"
								onPress={() => router.push("/connections" as Href)}
								style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}
							>
								<ThemedText style={[styles.linkText, { color: theme.tint }]}>
									{t("dailyQuestion.seeAnswers")}
								</ThemedText>
								<Ionicons name="chevron-forward" size={18} color={theme.tint} />
							</Pressable>
						</>
					) : (
						<>
							<ThemedText type="caption" style={{ color: theme.muted }}>
								{t("dailyQuestion.unlockHint")}
							</ThemedText>
							<Button label={t("dailyQuestion.shareCTA")} onPress={openModal} />
						</>
					)}
				</>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	eyebrow: {
		flex: 1,
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 2,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.sm,
		paddingVertical: 2,
	},
	badgeText: {
		fontWeight: "600",
	},
	question: {
		lineHeight: 28,
	},
	answer: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.sm,
		borderLeftWidth: 3,
		borderRadius: Radius.sm,
		padding: Spacing.md,
	},
	answerText: {
		flex: 1,
		fontSize: FontSize.md,
		lineHeight: 24,
		fontStyle: "italic",
	},
	linkRow: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: Spacing.xs,
	},
	linkText: {
		fontWeight: "600",
	},
});

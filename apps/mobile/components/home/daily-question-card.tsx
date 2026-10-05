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
		<View
			style={[
				styles.card,
				{
					backgroundColor: theme.accentSoft,
					borderColor: theme.tint,
				},
			]}
		>
			<ThemedText type="label">{t("home.todaysQuestion")}</ThemedText>

			{showLoading ? (
				<ActivityIndicator color={theme.tint} />
			) : answered ? (
				<>
					<Pressable
						accessibilityRole="button"
						onPress={openModal}
						style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
					>
						<ThemedText type="subtitle" style={styles.question}>
							{question}
						</ThemedText>
						<View style={styles.answeredRow}>
							<Ionicons name="checkmark-circle" size={22} color={theme.tint} />
							<ThemedText style={[styles.answerQuote, { color: theme.text }]}>{`"${answer}"`}</ThemedText>
						</View>
					</Pressable>
					<Button
						label={t("dailyQuestion.seeAnswers")}
						variant="secondary"
						onPress={() => router.push("/connections" as Href)}
					/>
					<ThemedText type="caption" style={{ color: theme.muted, textAlign: "center" }}>
						{t("dailyQuestion.editHint")}
					</ThemedText>
				</>
			) : (
				<Pressable
					accessibilityRole="button"
					onPress={openModal}
					style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, gap: Spacing.md })}
				>
					<ThemedText type="subtitle" style={styles.question}>
						{question}
					</ThemedText>
					<ThemedText style={{ color: theme.muted, textAlign: "center" }}>{t("dailyQuestion.unlockHint")}</ThemedText>
					<Button label={t("dailyQuestion.shareCTA")} onPress={openModal} />
				</Pressable>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.xl,
		gap: Spacing.md,
		alignItems: "stretch",
	},
	question: {
		textAlign: "center",
		lineHeight: 28,
		marginBottom: Spacing.sm,
	},
	answeredRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.sm,
	},
	answerQuote: {
		flex: 1,
		fontSize: FontSize.md,
		lineHeight: 24,
		fontStyle: "italic",
	},
});

import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import {
	DAILY_ANSWER_MAX_LENGTH,
	fetchTodayDailyQuestion,
	saveTodayDailyQuestion,
	todayDailyQuestionQueryKey,
} from "@/lib/api/daily-question";
import { recommendationsQueryKey } from "@/lib/api/recommendations";

type StarterId = "today" | "grateful" | "noticed";

const PLACEHOLDER_KEYS = [
	"dailyQuestion.placeholders.one",
	"dailyQuestion.placeholders.two",
	"dailyQuestion.placeholders.three",
] as const;

export default function DailyQuestionScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<string | undefined>(undefined);
	const [starter, setStarter] = useState<StarterId | undefined>(undefined);
	const [confirmed, setConfirmed] = useState(false);
	const [placeholderKey] = useState(
		() => PLACEHOLDER_KEYS[Math.floor(Math.random() * PLACEHOLDER_KEYS.length)] as (typeof PLACEHOLDER_KEYS)[number],
	);

	const todayQuestion = useQuery({
		queryKey: todayDailyQuestionQueryKey,
		queryFn: fetchTodayDailyQuestion,
	});

	const savedAnswer = todayQuestion.data?.answer?.trim() ?? "";
	const text = draft ?? todayQuestion.data?.answer ?? "";

	const starterOptions = useMemo(
		() =>
			(
				[
					{ value: "today" as const, label: t("dailyQuestion.starters.today") },
					{ value: "grateful" as const, label: t("dailyQuestion.starters.grateful") },
					{ value: "noticed" as const, label: t("dailyQuestion.starters.noticed") },
				] as const
			).slice(),
		[t],
	);

	const saveAnswer = useMutation({
		mutationFn: saveTodayDailyQuestion,
		onSuccess: async (result) => {
			queryClient.setQueryData(todayDailyQuestionQueryKey, result);
			await queryClient.invalidateQueries({ queryKey: recommendationsQueryKey });
			setConfirmed(true);
			setTimeout(() => router.back(), 1400);
		},
	});

	const trimmed = text.trim();
	const canShare = trimmed.length > 0 && trimmed !== savedAnswer;
	const question = todayQuestion.data?.question ?? "";

	const onStarterChange = (value: StarterId) => {
		setStarter(value);
		const prefix = t(`dailyQuestion.starterPrefixes.${value}`);
		setDraft((current) => {
			const base = current ?? todayQuestion.data?.answer ?? "";
			return base.startsWith(prefix) ? base : prefix;
		});
	};

	const onShare = () => {
		if (!canShare || saveAnswer.isPending) {
			return;
		}

		saveAnswer.mutate(trimmed);
	};

	if (confirmed) {
		return (
			<FormScreen title={question} showBack onBack={() => router.back()}>
				<View style={styles.confirmation}>
					<Ionicons name="checkmark-circle" size={56} color={theme.tint} />
					<ThemedText type="subtitle" style={styles.confirmationTitle}>
						{t("dailyQuestion.sharedTitle")}
					</ThemedText>
					<ThemedText style={{ color: theme.muted, textAlign: "center" }}>
						{t("dailyQuestion.sharedSubtitle")}
					</ThemedText>
				</View>
			</FormScreen>
		);
	}

	return (
		<FormScreen
			title={question}
			subtitle={t("dailyQuestion.modalSubtitle")}
			showBack
			onBack={() => router.back()}
			footer={
				<>
					<ErrorBanner message={saveAnswer.isError ? t("dailyQuestion.saveError") : undefined} />
					<Button
						label={t("dailyQuestion.share")}
						onPress={onShare}
						disabled={!canShare}
						loading={saveAnswer.isPending}
					/>
				</>
			}
		>
			<ChipGroup<StarterId>
				label={t("dailyQuestion.startersLabel")}
				options={starterOptions}
				value={starter}
				onChange={onStarterChange}
			/>

			<TextField
				label={t("dailyQuestion.answerLabel")}
				placeholder={t(placeholderKey)}
				value={text}
				onChangeText={setDraft}
				maxLength={DAILY_ANSWER_MAX_LENGTH}
				showCounter
				multiline
				autoFocus
			/>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	confirmation: {
		alignItems: "center",
		gap: Spacing.md,
		paddingTop: Spacing.xxl,
	},
	confirmationTitle: {
		textAlign: "center",
	},
});

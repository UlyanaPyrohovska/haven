import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { InfoButton } from "@/components/ui/info-button";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { fetchTodayMood, saveTodayMood, todayMoodQueryKey } from "@/lib/api/mood";
import { MoodEmoji, type MoodSlug, MoodSlugs } from "@/lib/mood";

export function MoodCard() {
	const { t } = useTranslation();
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [draftMood, setDraftMood] = useState<MoodSlug | null>(null);
	const [displayMood, setDisplayMood] = useState<MoodSlug | null>(null);

	const todayMood = useQuery({
		queryKey: todayMoodQueryKey,
		queryFn: fetchTodayMood,
	});

	useEffect(() => {
		if (todayMood.data) {
			setDisplayMood(todayMood.data.mood);
		}
	}, [todayMood.data]);

	const saveMood = useMutation({
		mutationFn: saveTodayMood,
		onSuccess: (result) => {
			setDisplayMood(result.mood);
			queryClient.setQueryData(todayMoodQueryKey, result);
			setPickerOpen(false);
		},
	});

	const selectedMood = displayMood;
	const showLoading = todayMood.isLoading && selectedMood === null;

	const openPicker = () => {
		setDraftMood(selectedMood);
		setPickerOpen(true);
	};

	const onSave = () => {
		if (!draftMood || saveMood.isPending) {
			return;
		}

		saveMood.mutate(draftMood);
	};

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("home.mood.accessibilityLabel")}
				onPress={openPicker}
				style={({ pressed }) => [
					styles.card,
					{
						backgroundColor: theme.surface,
						borderColor: theme.border,
						opacity: pressed ? 0.85 : 1,
					},
				]}
			>
				<View style={[styles.emojiBubble, { backgroundColor: theme.accentSoft }]}>
					{showLoading ? (
						<ActivityIndicator color={theme.tint} />
					) : selectedMood ? (
						<ThemedText style={styles.emoji}>{MoodEmoji[selectedMood]}</ThemedText>
					) : (
						<Ionicons name="happy-outline" size={28} color={theme.tint} />
					)}
				</View>
				<View style={styles.cardText}>
					<View style={styles.eyebrowRow}>
						<ThemedText type="caption" style={[styles.eyebrow, { color: theme.muted }]}>
							{t("home.mood.label")}
						</ThemedText>
						<InfoButton title={t("home.mood.infoTitle")} message={t("home.mood.infoBody")} />
					</View>
					<ThemedText type="subtitle" numberOfLines={1}>
						{selectedMood ? t(`home.mood.options.${selectedMood}`) : t("home.moodPrompt")}
					</ThemedText>
				</View>
				<View style={[styles.actionPill, { backgroundColor: theme.accentSoft }]}>
					<ThemedText type="caption" style={[styles.actionText, { color: theme.tint }]}>
						{selectedMood ? t("home.mood.edit") : t("home.mood.checkIn")}
					</ThemedText>
				</View>
			</Pressable>

			<Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
				<View style={styles.modalRoot}>
					<Pressable
						style={[styles.backdrop, { backgroundColor: theme.scrim }]}
						onPress={() => setPickerOpen(false)}
						accessibilityLabel={t("common.close")}
					/>

					<View
						style={[
							styles.sheet,
							{
								backgroundColor: theme.background,
								borderColor: theme.border,
								paddingBottom: insets.bottom + Spacing.lg,
							},
						]}
					>
						<View style={styles.sheetHeader}>
							<ThemedText type="subtitle">{t("home.moodPrompt")}</ThemedText>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t("common.close")}
								onPress={() => setPickerOpen(false)}
								hitSlop={Spacing.sm}
							>
								<Ionicons name="close" size={22} color={theme.icon} />
							</Pressable>
						</View>

						<View style={styles.grid}>
							{MoodSlugs.map((slug) => {
								const selected = draftMood === slug;

								return (
									<Pressable
										key={slug}
										accessibilityRole="button"
										accessibilityState={{ selected }}
										onPress={() => setDraftMood(slug)}
										style={({ pressed }) => [
											styles.option,
											{
												backgroundColor: selected ? theme.tint : theme.field,
												borderColor: selected ? theme.tint : theme.border,
												opacity: pressed ? 0.85 : 1,
											},
										]}
									>
										<ThemedText style={styles.optionEmoji}>{MoodEmoji[slug]}</ThemedText>
										<ThemedText
											type="label"
											style={{ color: selected ? theme.onTint : theme.text, textAlign: "center" }}
										>
											{t(`home.mood.options.${slug}`)}
										</ThemedText>
									</Pressable>
								);
							})}
						</View>

						{saveMood.isError ? (
							<ThemedText type="caption" style={{ color: theme.danger, textAlign: "center" }}>
								{t("home.mood.saveError")}
							</ThemedText>
						) : null}

						<Button label={t("home.mood.save")} onPress={onSave} disabled={!draftMood} loading={saveMood.isPending} />
					</View>
				</View>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.lg,
		padding: Spacing.lg,
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
	},
	emojiBubble: {
		width: 52,
		height: 52,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	emoji: {
		fontSize: 28,
		lineHeight: 34,
	},
	cardText: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	eyebrowRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
	},
	eyebrow: {
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	actionPill: {
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
	},
	actionText: {
		fontWeight: "600",
	},
	modalRoot: {
		flex: 1,
		justifyContent: "flex-end",
	},
	backdrop: {
		...StyleSheet.absoluteFill,
	},
	sheet: {
		borderTopLeftRadius: Radius.lg,
		borderTopRightRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.xl,
		gap: Spacing.xl,
	},
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.md,
	},
	option: {
		width: "47%",
		minHeight: 104,
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.md,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.sm,
	},
	optionEmoji: {
		fontSize: 36,
		lineHeight: 42,
	},
});

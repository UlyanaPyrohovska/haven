import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileBadges } from "@/components/connections/profile-badges";
import { ThemedText } from "@/components/themed-text";
import { InterestChip, InterestChipRow } from "@/components/ui/interest-chip";
import { ModeBadge } from "@/components/ui/mode-badge";
import { FontSize, Radius, Spacing } from "@/constants/app-config";
import { useMode } from "@/hooks/use-mode";
import { useTheme } from "@/hooks/use-theme";
import { fetchTodayDailyQuestion, todayDailyQuestionQueryKey } from "@/lib/api/daily-question";
import { fetchTodayMood, todayMoodQueryKey } from "@/lib/api/mood";
import { profileInitials } from "@/lib/profile/display";

type ProfilePublicPreviewProps = {
	visible: boolean;
	onClose: () => void;
	displayName: string;
	photoUrl?: string | null;
	ageLabel?: string;
	career?: string;
	bio?: string;
	interests: string[];
};

export function ProfilePublicPreview({
	visible,
	onClose,
	displayName,
	photoUrl,
	ageLabel,
	career,
	bio,
	interests,
}: ProfilePublicPreviewProps) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { t } = useTranslation();
	const mode = useMode();
	const initials = profileInitials(displayName);
	const overlaySubtext = [ageLabel, career].filter(Boolean).join(" · ");
	// Same sources the candidate view reads for other users: today's mood and daily answer.
	const mood = useQuery({ queryKey: todayMoodQueryKey, queryFn: fetchTodayMood, enabled: visible });
	const dailyQuestion = useQuery({
		queryKey: todayDailyQuestionQueryKey,
		queryFn: fetchTodayDailyQuestion,
		enabled: visible,
	});

	return (
		<Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
			<View style={[styles.root, { backgroundColor: theme.background }]}>
				<ScrollView
					contentContainerStyle={[
						styles.scroll,
						{
							paddingTop: insets.top + Spacing.md,
							paddingBottom: insets.bottom + Spacing.xl,
						},
					]}
					showsVerticalScrollIndicator={false}
				>
					<View style={styles.header}>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("profile.preview.close")}
							onPress={onClose}
							style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.field, opacity: pressed ? 0.7 : 1 }]}
						>
							<Ionicons name="close" size={22} color={theme.text} />
						</Pressable>
					</View>

					<ThemedText type="title">{t("profile.preview.title")}</ThemedText>
					<ThemedText style={{ color: theme.muted }}>{t("profile.preview.subtitle")}</ThemedText>

					<View style={[styles.photoCard, { backgroundColor: theme.field, borderColor: theme.border }]}>
						{photoUrl ? (
							<Image source={{ uri: photoUrl }} style={styles.photoImage} contentFit="cover" contentPosition="top" />
						) : (
							<View style={[styles.photoImage, styles.photoPlaceholder, { backgroundColor: theme.accentSoft }]}>
								<ThemedText type="title" style={{ color: theme.tint, fontSize: 56 }}>
									{initials}
								</ThemedText>
							</View>
						)}
						<View style={styles.photoScrim} />
						{mode ? (
							<View style={styles.modeRibbon}>
								<ModeBadge mode={mode} />
							</View>
						) : null}

						<View style={styles.photoOverlay}>
							<ThemedText type="title" style={styles.photoOverlayText}>
								{displayName}
							</ThemedText>
							{overlaySubtext ? <ThemedText style={styles.photoOverlaySubtext}>{overlaySubtext}</ThemedText> : null}
						</View>
					</View>

					<ProfileBadges mood={mood.data?.mood ?? null} isSynthetic={false} />

					{dailyQuestion.data ? (
						<View style={styles.block}>
							<ThemedText type="label">{t("home.todaysQuestion")}</ThemedText>
							<ThemedText
								style={[styles.quote, { color: theme.muted }]}
							>{`"${dailyQuestion.data.question}"`}</ThemedText>
							<View style={[styles.answerBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
								<ThemedText style={{ lineHeight: 22, color: dailyQuestion.data.answer ? theme.text : theme.muted }}>
									{dailyQuestion.data.answer ?? t("dailyQuestion.noAnswerYet")}
								</ThemedText>
							</View>
						</View>
					) : null}

					{bio ? (
						<View style={styles.block}>
							<ThemedText type="label">{t("profile.about")}</ThemedText>
							<View style={[styles.answerBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
								<ThemedText style={{ lineHeight: 22 }}>{bio}</ThemedText>
							</View>
						</View>
					) : null}

					{interests.length > 0 ? (
						<View style={styles.block}>
							<ThemedText type="label">{t("profile.interests")}</ThemedText>
							<InterestChipRow>
								{interests.map((interest) => (
									<InterestChip key={interest} label={interest} />
								))}
							</InterestChipRow>
						</View>
					) : null}
				</ScrollView>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	scroll: {
		paddingHorizontal: Spacing.xl,
		gap: Spacing.lg,
	},
	header: {
		flexDirection: "row",
		justifyContent: "flex-end",
	},
	iconButton: {
		width: 40,
		height: 40,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	photoCard: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	photoImage: {
		aspectRatio: 4 / 5,
		width: "100%",
	},
	photoPlaceholder: {
		alignItems: "center",
		justifyContent: "center",
	},
	photoScrim: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: 96,
		backgroundColor: "rgba(0, 0, 0, 0.35)",
	},
	modeRibbon: {
		position: "absolute",
		top: Spacing.md,
		left: Spacing.md,
	},
	photoOverlay: {
		position: "absolute",
		left: Spacing.lg,
		right: Spacing.lg,
		bottom: Spacing.lg,
		gap: Spacing.xs,
	},
	photoOverlayText: {
		color: "#ffffff",
	},
	photoOverlaySubtext: {
		color: "#ffffff",
		opacity: 0.92,
	},
	block: {
		gap: Spacing.sm,
	},
	quote: {
		fontSize: FontSize.md,
		lineHeight: 24,
		fontStyle: "italic",
	},
	answerBubble: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
});

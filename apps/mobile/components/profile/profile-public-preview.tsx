import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { InterestChip, InterestChipRow } from "@/components/ui/interest-chip";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
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
	const photoInterests = interests.slice(0, 3);
	const initials = profileInitials(displayName);

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
							<Image source={{ uri: photoUrl }} style={styles.photoImage} contentFit="cover" />
						) : (
							<View style={[styles.photoPlaceholder, { backgroundColor: theme.accentSoft }]}>
								<ThemedText type="title" style={{ color: theme.tint, fontSize: 56 }}>
									{initials}
								</ThemedText>
							</View>
						)}
						<View style={styles.photoScrim} />

						<View style={styles.photoOverlay}>
							<ThemedText type="title" style={styles.photoOverlayText}>
								{displayName}
							</ThemedText>
							{ageLabel ? <ThemedText style={styles.photoOverlaySubtext}>{ageLabel}</ThemedText> : null}
							{career ? <ThemedText style={styles.photoOverlaySubtext}>{career}</ThemedText> : null}
							{photoInterests.length > 0 ? (
								<View style={styles.photoTags}>
									<InterestChipRow>
										{photoInterests.map((interest) => (
											<InterestChip key={interest} label={interest} onPhoto />
										))}
									</InterestChipRow>
								</View>
							) : null}
						</View>
					</View>

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
		height: 320,
		width: "100%",
	},
	photoPlaceholder: {
		height: 320,
		alignItems: "center",
		justifyContent: "center",
	},
	photoScrim: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: 160,
		backgroundColor: "rgba(0, 0, 0, 0.42)",
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
	photoTags: {
		marginTop: Spacing.sm,
	},
	block: {
		gap: Spacing.sm,
	},
	answerBubble: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
});

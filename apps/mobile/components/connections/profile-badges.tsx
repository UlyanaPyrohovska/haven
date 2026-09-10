import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { MoodEmoji, type MoodSlug } from "@/lib/mood";

type ProfileBadgesProps = {
	mood: MoodSlug | null;
	isSynthetic: boolean;
	/** Use light text for overlays on dark photo scrims. */
	inverted?: boolean;
};

export function ProfileBadges({ mood, isSynthetic, inverted = false }: ProfileBadgesProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const pillBackground = inverted ? "rgba(255, 255, 255, 0.18)" : theme.surface;
	const pillBorder = inverted ? "rgba(255, 255, 255, 0.35)" : theme.border;
	const textColor = inverted ? "#ffffff" : theme.text;
	const mutedColor = inverted ? "rgba(255, 255, 255, 0.88)" : theme.muted;

	return (
		<View style={styles.row}>
			{mood ? (
				<View style={[styles.pill, { backgroundColor: pillBackground, borderColor: pillBorder }]}>
					<ThemedText style={styles.moodEmoji}>{MoodEmoji[mood]}</ThemedText>
					<ThemedText type="caption" style={[styles.pillText, { color: mutedColor }]}>
						{t(`home.mood.options.${mood}`)}
					</ThemedText>
				</View>
			) : null}

			<View style={[styles.pill, { backgroundColor: pillBackground, borderColor: pillBorder }]}>
				<Ionicons
					name={isSynthetic ? "sparkles-outline" : "person-outline"}
					size={14}
					color={isSynthetic ? theme.tint : textColor}
				/>
				<ThemedText type="caption" style={[styles.pillText, { color: isSynthetic ? theme.tint : textColor }]}>
					{isSynthetic ? t("connections.aiAgentBadge") : t("connections.realPersonBadge")}
				</ThemedText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
	},
	pillText: {
		fontWeight: "600",
	},
	moodEmoji: {
		fontSize: 14,
		lineHeight: 16,
	},
});

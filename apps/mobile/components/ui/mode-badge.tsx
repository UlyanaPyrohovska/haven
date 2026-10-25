import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { type AppMode, Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export const ModeIcon = {
	friends: "people",
	dating: "heart",
} as const satisfies Record<AppMode, keyof typeof Ionicons.glyphMap>;

/** "Here for friends" / "Here for dating" pill in the mode's accent. */
export function ModeBadge({ mode }: { mode: AppMode }) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<View style={[styles.pill, { backgroundColor: theme.tint }]}>
			<Ionicons name={ModeIcon[mode]} size={14} color={theme.onTint} />
			<ThemedText type="caption" style={[styles.text, { color: theme.onTint }]}>
				{t("mode.badge", { context: mode })}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	pill: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: Spacing.xs,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		borderRadius: Radius.pill,
	},
	text: {
		fontWeight: "600",
	},
});

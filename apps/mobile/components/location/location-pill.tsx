import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

type LocationPillProps = {
	label: string;
	hidden?: boolean;
	unset?: boolean;
};

export function LocationPill({ label, hidden = false, unset = false }: LocationPillProps) {
	const theme = useTheme();
	const muted = unset || hidden;
	const iconColor = muted ? theme.muted : theme.icon;

	return (
		<View style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
			{hidden ? (
				<MaterialIcons name="location-off" size={14} color={iconColor} />
			) : (
				<Ionicons name={unset ? "add-outline" : "location-outline"} size={14} color={iconColor} />
			)}
			<ThemedText
				type="caption"
				style={[styles.label, muted ? { color: theme.muted } : undefined]}
				numberOfLines={1}
				adjustsFontSizeToFit
				minimumFontScale={0.85}
			>
				{label}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		maxWidth: "100%",
	},
	label: {
		flexShrink: 1,
	},
});

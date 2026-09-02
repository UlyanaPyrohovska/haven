import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type ScaleLegendProps = {
	low: string;
	high: string;
};

/** Labels the ends of a slider group so the direction of the scale is unambiguous. */
export function ScaleLegend({ low, high }: ScaleLegendProps) {
	const theme = useTheme();

	return (
		<View style={styles.root}>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{low}
			</ThemedText>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{high}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: Spacing.md,
	},
});

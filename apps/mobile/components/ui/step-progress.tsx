import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";

export type StepProgressProps = {
	current: number;
	total: number;
};

export function StepProgress({ current, total }: StepProgressProps) {
	const theme = useTheme();
	const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;

	return (
		<View
			style={styles.root}
			accessibilityRole="progressbar"
			accessibilityLabel={Strings.onboarding.stepOf(current, total)}
			accessibilityValue={{ min: 0, max: total, now: current }}
		>
			<View style={[styles.track, { backgroundColor: theme.track }]}>
				<View style={[styles.fill, { backgroundColor: theme.tint, width: `${ratio * 100}%` }]} />
			</View>
			<ThemedText type="caption" style={{ color: theme.muted }}>
				{Strings.onboarding.stepOf(current, total)}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.sm,
		marginBottom: Spacing.lg,
	},
	track: {
		height: 4,
		borderRadius: Radius.pill,
		overflow: "hidden",
	},
	fill: {
		height: "100%",
		borderRadius: Radius.pill,
	},
});

import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type ErrorBannerProps = {
	message: string | undefined;
	/** "info" renders a neutral notice instead of an error. */
	tone?: "danger" | "info";
};

/** Surfaces request-level failures above the primary action. Renders nothing when there is no error. */
export function ErrorBanner({ message, tone = "danger" }: ErrorBannerProps) {
	const theme = useTheme();
	const color = tone === "info" ? theme.link : theme.danger;

	if (!message) {
		return null;
	}

	return (
		<View accessibilityRole="alert" style={[styles.root, { borderColor: color }]}>
			<ThemedText type="caption" style={{ color }}>
				{message}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		borderRadius: Radius.md,
		borderWidth: 1,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
});

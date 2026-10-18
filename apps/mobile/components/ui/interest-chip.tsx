import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type InterestChipProps = {
	label: string;
	/** Tint the chip, e.g. for interests the viewer shares. */
	highlighted?: boolean;
	/** Translucent white-on-dark variant for text drawn over a photo. */
	onPhoto?: boolean;
};

/** Read-only interest pill, shared by the profile, its public preview and the connection screen. */
export function InterestChip({ label, highlighted = false, onPhoto = false }: InterestChipProps) {
	const theme = useTheme();

	const colors = onPhoto
		? { backgroundColor: "rgba(255, 255, 255, 0.22)", borderColor: "rgba(255, 255, 255, 0.45)", color: "#ffffff" }
		: highlighted
			? { backgroundColor: theme.accentSoft, borderColor: theme.tint, color: theme.text }
			: { backgroundColor: theme.field, borderColor: theme.border, color: theme.text };

	return (
		<View style={[styles.chip, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
			<ThemedText type="caption" style={{ color: colors.color }}>
				{label}
			</ThemedText>
		</View>
	);
}

export function InterestChipRow({ children }: { children: ReactNode }) {
	return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	chip: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
	},
});

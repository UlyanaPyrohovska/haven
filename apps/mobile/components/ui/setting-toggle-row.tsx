import { Switch, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

type SettingToggleRowProps = {
	label: string;
	subtitle?: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
	disabled?: boolean;
};

export function SettingToggleRow({ label, subtitle, value, onValueChange, disabled = false }: SettingToggleRowProps) {
	const theme = useTheme();

	return (
		<View style={styles.row}>
			<View style={styles.copy}>
				<ThemedText type="label" style={disabled ? { color: theme.muted } : undefined}>
					{label}
				</ThemedText>
				{subtitle ? (
					<ThemedText type="caption" style={{ color: theme.muted }}>
						{subtitle}
					</ThemedText>
				) : null}
			</View>
			<Switch
				value={value}
				onValueChange={onValueChange}
				disabled={disabled}
				trackColor={{ false: theme.border, true: theme.tint }}
				thumbColor="#ffffff"
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.lg,
		gap: Spacing.md,
	},
	copy: {
		flex: 1,
		gap: Spacing.xs,
	},
});

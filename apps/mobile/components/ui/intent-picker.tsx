import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import type { LookingForValue } from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";

export type IntentOption = {
	value: LookingForValue;
	label: string;
	subtitle: string;
};

export type IntentPickerProps = {
	label: string;
	hint?: string;
	options: readonly IntentOption[];
	value: LookingForValue | undefined;
	onChange: (value: LookingForValue) => void;
	error?: string;
};

/** Two-card picker for friends vs dating — the primary matching gate. */
export function IntentPicker({ label, hint, options, value, onChange, error }: IntentPickerProps) {
	const theme = useTheme();

	return (
		<View style={styles.group}>
			<ThemedText type="label">{label}</ThemedText>
			{hint ? (
				<ThemedText type="caption" style={{ color: theme.muted }}>
					{hint}
				</ThemedText>
			) : null}

			<View style={styles.cards}>
				{options.map((option) => {
					const selected = value === option.value;

					return (
						<Pressable
							key={option.value}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							onPress={() => onChange(option.value)}
							style={({ pressed }) => [
								styles.card,
								{
									backgroundColor: selected ? theme.tint : theme.field,
									borderColor: selected ? theme.tint : theme.border,
									opacity: pressed ? 0.85 : 1,
								},
							]}
						>
							<ThemedText
								type="label"
								style={{ color: selected ? theme.onTint : theme.text, textAlign: "center" }}
							>
								{option.label}
							</ThemedText>
							<ThemedText
								type="caption"
								style={{
									color: selected ? theme.onTint : theme.muted,
									textAlign: "center",
									marginTop: Spacing.xs,
								}}
							>
								{option.subtitle}
							</ThemedText>
						</Pressable>
					);
				})}
			</View>

			{error ? (
				<ThemedText type="caption" style={{ color: theme.danger }}>
					{error}
				</ThemedText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	group: {
		gap: Spacing.sm,
	},
	cards: {
		flexDirection: "row",
		gap: Spacing.sm,
	},
	card: {
		flex: 1,
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.lg,
	},
});

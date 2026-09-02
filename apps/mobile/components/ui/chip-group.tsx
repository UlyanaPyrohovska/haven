import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type OptionChipProps = {
	label: string;
	selected: boolean;
	onPress: () => void;
};

export function OptionChip({ label, selected, onPress }: OptionChipProps) {
	const theme = useTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={({ pressed }) => [
				styles.chip,
				{
					backgroundColor: selected ? theme.tint : theme.field,
					opacity: pressed ? 0.75 : 1,
				},
			]}
		>
			<ThemedText type="label" style={{ color: selected ? theme.onTint : theme.text }}>
				{label}
			</ThemedText>
		</Pressable>
	);
}

export type ChipGroupOption<T> = {
	value: T;
	label: string;
};

export type ChipGroupProps<T> = {
	label: string;
	options: readonly ChipGroupOption<T>[];
	value: T | undefined;
	onChange: (value: T) => void;
	error?: string;
};

/** Single-select pill group, used for gender and goal in onboarding. */
export function ChipGroup<T extends string | number>({ label, options, value, onChange, error }: ChipGroupProps<T>) {
	const theme = useTheme();

	return (
		<View style={styles.group}>
			<ThemedText type="label">{label}</ThemedText>

			<View style={styles.chips}>
				{options.map((option) => (
					<OptionChip
						key={String(option.value)}
						label={option.label}
						selected={value === option.value}
						onPress={() => onChange(option.value)}
					/>
				))}
			</View>

			{error ? (
				<ThemedText type="caption" style={{ color: theme.danger }}>
					{error}
				</ThemedText>
			) : null}
		</View>
	);
}

export type MultiChipGroupProps<T> = {
	label: string;
	options: readonly ChipGroupOption<T>[];
	values: readonly T[];
	onToggle: (value: T) => void;
};

/** Multi-select pill group, used for the interest pick-list in onboarding. */
export function MultiChipGroup<T extends string | number>({
	label,
	options,
	values,
	onToggle,
}: MultiChipGroupProps<T>) {
	const theme = useTheme();

	return (
		<View style={styles.group}>
			<ThemedText type="label" style={{ color: theme.muted }}>
				{label}
			</ThemedText>

			<View style={styles.chips}>
				{options.map((option) => (
					<OptionChip
						key={String(option.value)}
						label={option.label}
						selected={values.includes(option.value)}
						onPress={() => onToggle(option.value)}
					/>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	chip: {
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
	group: {
		gap: Spacing.sm,
	},
	chips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
});

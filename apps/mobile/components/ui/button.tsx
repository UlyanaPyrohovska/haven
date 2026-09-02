import { ActivityIndicator, Pressable, type PressableProps, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
	label: string;
	variant?: ButtonVariant;
	loading?: boolean;
};

export function Button({ label, variant = "primary", loading = false, disabled, ...rest }: ButtonProps) {
	const theme = useTheme();
	const isDisabled = disabled === true || loading;

	const background = variant === "primary" ? theme.tint : variant === "secondary" ? theme.field : "transparent";
	const foreground = variant === "primary" ? theme.onTint : theme.text;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ disabled: isDisabled, busy: loading }}
			disabled={isDisabled}
			style={({ pressed }) => [
				styles.root,
				variant === "ghost" && styles.ghost,
				{ backgroundColor: background, opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1 },
			]}
			{...rest}
		>
			{loading ? (
				<ActivityIndicator color={foreground} />
			) : (
				<ThemedText type="bodySemiBold" style={{ color: foreground }}>
					{label}
				</ThemedText>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	root: {
		height: 54,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.xl,
	},
	ghost: {
		height: 44,
	},
});

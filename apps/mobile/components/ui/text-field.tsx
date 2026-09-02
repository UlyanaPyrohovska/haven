import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	type StyleProp,
	StyleSheet,
	TextInput,
	type TextInputProps,
	Pressable,
	View,
	type ViewStyle,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { FontFamily, FontSize, LineHeight, Radius, Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";

export type TextFieldProps = TextInputProps & {
	label: string;
	error?: string;
	/** Helper copy shown under the input while there is no error. */
	hint?: string;
	/** Shows a `used / maxLength` counter; requires `maxLength`. */
	showCounter?: boolean;
	containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({
	label,
	error,
	hint,
	showCounter = false,
	containerStyle,
	style,
	multiline,
	value,
	maxLength,
	secureTextEntry = false,
	...rest
}: TextFieldProps) {
	const theme = useTheme();
	const [focused, setFocused] = useState(false);
	const [passwordVisible, setPasswordVisible] = useState(false);

	const borderColor = error ? theme.danger : focused ? theme.tint : "transparent";
	const isPasswordField = secureTextEntry === true;

	const toggleLabel = passwordVisible ? Strings.auth.fields.hidePassword : Strings.auth.fields.showPassword;

	return (
		<View style={[styles.root, containerStyle]}>
			<ThemedText type="label">{label}</ThemedText>

			<View style={styles.inputWrap}>
				<TextInput
					accessibilityLabel={label}
					placeholderTextColor={theme.placeholder}
					selectionColor={theme.tint}
					multiline={multiline}
					value={value}
					maxLength={maxLength}
					secureTextEntry={isPasswordField && !passwordVisible}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					style={[
						styles.input,
						multiline && styles.inputMultiline,
						isPasswordField && styles.inputWithToggle,
						{ backgroundColor: theme.field, color: theme.text, borderColor },
						style,
					]}
					{...rest}
				/>

				{isPasswordField ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={toggleLabel}
						hitSlop={Spacing.sm}
						onPress={() => setPasswordVisible((visible) => !visible)}
						style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.5 : 1 }]}
					>
						<Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={20} color={theme.muted} />
					</Pressable>
				) : null}
			</View>

			<View style={styles.meta}>
				{error ? (
					<ThemedText type="caption" style={[styles.metaText, { color: theme.danger }]}>
						{error}
					</ThemedText>
				) : hint ? (
					<ThemedText type="caption" style={[styles.metaText, { color: theme.muted }]}>
						{hint}
					</ThemedText>
				) : (
					<View style={styles.metaText} />
				)}

				{showCounter && maxLength ? (
					<ThemedText type="caption" style={{ color: theme.muted }}>
						{`${value?.length ?? 0}/${maxLength}`}
					</ThemedText>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.sm,
	},
	inputWrap: {
		position: "relative",
		justifyContent: "center",
	},
	input: {
		minHeight: 52,
		borderRadius: Radius.md,
		borderWidth: 1.5,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		fontSize: FontSize.md,
		lineHeight: LineHeight.md,
		fontFamily: FontFamily.body,
	},
	inputWithToggle: {
		paddingRight: Spacing.xxl + Spacing.lg,
	},
	inputMultiline: {
		minHeight: 132,
		textAlignVertical: "top",
	},
	toggle: {
		position: "absolute",
		right: Spacing.lg,
		height: 52,
		justifyContent: "center",
	},
	meta: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	metaText: {
		flex: 1,
	},
});

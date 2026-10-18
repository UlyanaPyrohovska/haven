import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { FontFamily, FontSize, Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { MESSAGE_MAX_LENGTH } from "@/lib/api/chat";

type ComposerProps = {
	value: string;
	onChangeText: (value: string) => void;
	onSend: () => void;
	disabled?: boolean;
};

export function Composer({ value, onChangeText, onSend, disabled = false }: ComposerProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const canSend = !disabled && value.trim().length > 0;

	return (
		<View style={[styles.root, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
			<TextInput
				accessibilityLabel={t("chat.placeholder")}
				placeholder={t("chat.placeholder")}
				placeholderTextColor={theme.placeholder}
				value={value}
				onChangeText={onChangeText}
				maxLength={MESSAGE_MAX_LENGTH}
				multiline
				editable={!disabled}
				style={[styles.input, { backgroundColor: theme.field, color: theme.text }]}
			/>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("chat.send")}
				disabled={!canSend}
				onPress={onSend}
				style={({ pressed }) => [
					styles.send,
					{ backgroundColor: canSend ? theme.tint : theme.track, opacity: pressed ? 0.7 : 1 },
				]}
			>
				<Ionicons name="arrow-up" size={20} color={canSend ? theme.onTint : theme.muted} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: Spacing.sm,
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.sm,
		paddingBottom: Spacing.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	input: {
		flex: 1,
		minHeight: 44,
		maxHeight: 120,
		borderRadius: Radius.lg,
		paddingHorizontal: Spacing.lg,
		paddingTop: 12,
		paddingBottom: 12,
		fontFamily: FontFamily.body,
		fontSize: FontSize.md,
	},
	send: {
		width: 44,
		height: 44,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
});

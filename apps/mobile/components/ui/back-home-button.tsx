import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

type BackHomeButtonProps = {
	onPress?: () => void;
	accessibilityLabel?: string;
};

export function BackHomeButton({ onPress, accessibilityLabel }: BackHomeButtonProps) {
	const navigation = useNavigation();
	const theme = useTheme();
	const { t } = useTranslation();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? t("common.backHome")}
			hitSlop={Spacing.sm}
			onPress={onPress ?? (() => navigation.goBack())}
			style={({ pressed }) => [styles.button, { backgroundColor: theme.field, opacity: pressed ? 0.6 : 1 }]}
		>
			<Ionicons name="chevron-back" size={20} color={theme.text} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		width: 40,
		height: 40,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
});

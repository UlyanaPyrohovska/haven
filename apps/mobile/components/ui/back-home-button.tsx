import { Ionicons } from "@expo/vector-icons";
import { type Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

type BackHomeButtonProps = {
	/** Defaults to `/home`. */
	href?: Href;
	onPress?: () => void;
	accessibilityLabel?: string;
};

/** Returns to the home screen — used where the stack has no reliable `router.back()` target. */
export function BackHomeButton({ href = "/home", onPress, accessibilityLabel }: BackHomeButtonProps) {
	const router = useRouter();
	const theme = useTheme();
	const { t } = useTranslation();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? t("common.backHome")}
			hitSlop={Spacing.sm}
			onPress={onPress ?? (() => router.replace(href))}
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

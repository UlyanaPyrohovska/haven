import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

import { Radius, Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";

type BackHomeButtonProps = {
	/** Defaults to `/home`. */
	href?: Href;
};

/** Returns to the home screen — used where the stack has no reliable `router.back()` target. */
export function BackHomeButton({ href = "/home" }: BackHomeButtonProps) {
	const router = useRouter();
	const theme = useTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={Strings.common.backHome}
			hitSlop={Spacing.sm}
			onPress={() => router.replace(href)}
			style={({ pressed }) => [
				styles.button,
				{ backgroundColor: theme.field, opacity: pressed ? 0.6 : 1 },
			]}
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

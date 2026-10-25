import type { Colors } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";

export function useThemeColor(
	props: { light?: string; dark?: string },
	colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
	const scheme = useColorScheme() ?? "light";
	const theme = useTheme();
	const colorFromProps = props[scheme];

	if (colorFromProps) {
		return colorFromProps;
	}

	return theme[colorName];
}

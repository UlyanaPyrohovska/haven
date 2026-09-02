import { Colors } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type Theme = typeof Colors.light | typeof Colors.dark;

/** Whole palette for the active scheme, for components that need several colours at once. */
export function useTheme(): Theme {
	return Colors[useColorScheme() ?? "light"];
}

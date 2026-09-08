import { useColorScheme as useRNColorScheme } from "react-native";

import { ThemePreference, useThemePreferenceValue } from "@/lib/theme-preference";

/** Resolved light/dark scheme after applying the user's appearance preference. */
export function useColorScheme(): "light" | "dark" {
	const preference = useThemePreferenceValue();
	const system = useRNColorScheme() ?? "light";

	if (preference === ThemePreference.light) {
		return "light";
	}

	if (preference === ThemePreference.dark) {
		return "dark";
	}

	return system;
}

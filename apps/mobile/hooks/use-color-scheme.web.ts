import { useEffect, useState } from "react";
import { useColorScheme as useRNColorScheme } from "react-native";

import { ThemePreference, useThemePreferenceValue } from "@/lib/theme/preference";

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 */
export function useColorScheme(): "light" | "dark" {
	const [hasHydrated, setHasHydrated] = useState(false);
	const preference = useThemePreferenceValue();
	const system = useRNColorScheme() ?? "light";

	useEffect(() => {
		setHasHydrated(true);
	}, []);

	if (!hasHydrated) {
		return "light";
	}

	if (preference === ThemePreference.light) {
		return "light";
	}

	if (preference === ThemePreference.dark) {
		return "dark";
	}

	return system === "dark" ? "dark" : "light";
}

import { useMemo } from "react";

import { Colors, ModeAccents } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMode } from "@/hooks/use-mode";

export type Theme = { [K in keyof typeof Colors.light]: string };

/** Whole palette for the active scheme, recoloured by the user's friends/dating mode once known. */
export function useTheme(): Theme {
	const scheme = useColorScheme() ?? "light";
	const mode = useMode();

	return useMemo(() => (mode ? { ...Colors[scheme], ...ModeAccents[mode][scheme] } : Colors[scheme]), [scheme, mode]);
}

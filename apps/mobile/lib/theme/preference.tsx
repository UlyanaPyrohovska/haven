import * as SecureStore from "expo-secure-store";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "haven.themePreference";

export const ThemePreference = {
	system: "system",
	light: "light",
	dark: "dark",
} as const;

export type ThemePreferenceValue = (typeof ThemePreference)[keyof typeof ThemePreference];

type ThemePreferenceContextValue = {
	preference: ThemePreferenceValue;
	setPreference: (value: ThemePreferenceValue) => void;
	ready: boolean;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreferenceValue {
	return value === ThemePreference.system || value === ThemePreference.light || value === ThemePreference.dark;
}

async function readStoredPreference(): Promise<ThemePreferenceValue> {
	const stored = await SecureStore.getItemAsync(STORAGE_KEY);

	return isThemePreference(stored) ? stored : ThemePreference.system;
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
	const [preference, setPreferenceState] = useState<ThemePreferenceValue>(ThemePreference.system);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		void readStoredPreference().then((value) => {
			setPreferenceState(value);
			setReady(true);
		});
	}, []);

	const setPreference = useCallback((value: ThemePreferenceValue) => {
		setPreferenceState(value);
		void SecureStore.setItemAsync(STORAGE_KEY, value);
	}, []);

	const context = useMemo(
		() => ({
			preference,
			setPreference,
			ready,
		}),
		[preference, setPreference, ready],
	);

	if (!ready) {
		return null;
	}

	return <ThemePreferenceContext.Provider value={context}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference(): ThemePreferenceContextValue {
	const context = useContext(ThemePreferenceContext);

	if (!context) {
		throw new Error("useThemePreference must be used within ThemePreferenceProvider");
	}

	return context;
}

/** Returns the stored preference when inside the provider; otherwise system. */
export function useThemePreferenceValue(): ThemePreferenceValue {
	return useContext(ThemePreferenceContext)?.preference ?? ThemePreference.system;
}

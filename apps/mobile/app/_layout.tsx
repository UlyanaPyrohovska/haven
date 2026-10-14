import { Kodchasan_500Medium } from "@expo-google-fonts/kodchasan";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AnimatedSplash, getReduceMotionEnabled } from "@/components/animated-splash";
import { UnauthorizedHandler } from "@/components/auth/unauthorized-handler";
import { Colors, FontFamily } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "@/lib/i18n";
import { ThemePreferenceProvider } from "@/lib/theme/preference";

// Hidden by AnimatedSplash once its first frame is laid out.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const NavigationLightTheme = {
	...DefaultTheme,
	colors: {
		...DefaultTheme.colors,
		background: Colors.light.background,
		text: Colors.light.text,
		primary: Colors.light.tint,
	},
};

const NavigationDarkTheme = {
	...DarkTheme,
	colors: {
		...DarkTheme.colors,
		background: Colors.dark.background,
		text: Colors.dark.text,
		primary: Colors.dark.tint,
	},
};

export default function RootLayout() {
	const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
	const [reduceMotion, setReduceMotion] = useState(false);
	const [preferencesReady, setPreferencesReady] = useState(false);

	// Registered under the family name the brand text styles reference.
	const [fontsLoaded, fontError] = useFonts({ [FontFamily.brand]: Kodchasan_500Medium });

	useEffect(() => {
		void (async () => {
			setReduceMotion(await getReduceMotionEnabled());
			setPreferencesReady(true);
		})();
	}, []);

	// A missing font shouldn't block launch; the brand text falls back to the system face.
	const appReady = preferencesReady && (fontsLoaded || fontError !== null);

	const onSplashFinish = useCallback(() => {
		setShowAnimatedSplash(false);
	}, []);

	if (!appReady) {
		return null;
	}

	return (
		<QueryClientProvider client={queryClient}>
			<SafeAreaProvider>
				<ThemePreferenceProvider>
					<RootLayoutContent
						showAnimatedSplash={showAnimatedSplash}
						onSplashFinish={onSplashFinish}
						reduceMotion={reduceMotion}
					/>
				</ThemePreferenceProvider>
			</SafeAreaProvider>
		</QueryClientProvider>
	);
}

function RootLayoutContent({
	showAnimatedSplash,
	onSplashFinish,
	reduceMotion,
}: {
	showAnimatedSplash: boolean;
	onSplashFinish: () => void;
	reduceMotion: boolean;
}) {
	const colorScheme = useColorScheme();

	return (
		<KeyboardProvider>
			<View style={styles.root}>
				<ThemeProvider value={colorScheme === "dark" ? NavigationDarkTheme : NavigationLightTheme}>
					<UnauthorizedHandler />
					<Stack
						screenOptions={{
							headerShown: false,
							contentStyle: {
								backgroundColor: colorScheme === "dark" ? Colors.dark.background : Colors.light.background,
							},
						}}
					>
						<Stack.Screen name="daily-question" options={{ presentation: "modal" }} />
					</Stack>
					<StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
				</ThemeProvider>
				{showAnimatedSplash ? <AnimatedSplash onFinish={onSplashFinish} reduceMotion={reduceMotion} /> : null}
			</View>
		</KeyboardProvider>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
});

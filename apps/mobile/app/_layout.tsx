import { Kodchasan_500Medium } from "@expo-google-fonts/kodchasan";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplash, getReduceMotionEnabled } from "@/components/animated-splash";
import { Colors, FontFamily } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";

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
	const colorScheme = useColorScheme();
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

	useEffect(() => {
		if (appReady) {
			void SplashScreen.hideAsync();
		}
	}, [appReady]);

	const onSplashFinish = useCallback(() => {
		setShowAnimatedSplash(false);
	}, []);

	if (!appReady) {
		return null;
	}

	return (
		<QueryClientProvider client={queryClient}>
			<SafeAreaProvider>
				<View style={styles.root}>
					<ThemeProvider value={colorScheme === "dark" ? NavigationDarkTheme : NavigationLightTheme}>
						<Stack screenOptions={{ headerShown: false }} />
						<StatusBar style="auto" />
					</ThemeProvider>
					{showAnimatedSplash ? <AnimatedSplash onFinish={onSplashFinish} reduceMotion={reduceMotion} /> : null}
				</View>
			</SafeAreaProvider>
		</QueryClientProvider>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
});

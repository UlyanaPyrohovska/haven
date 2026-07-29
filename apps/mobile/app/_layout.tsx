import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import "react-native-reanimated";

import { AnimatedSplash, getReduceMotionEnabled } from "@/components/animated-splash";
import { Colors } from "@/constants/app-config";
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
	const [appReady, setAppReady] = useState(false);

	useEffect(() => {
		void (async () => {
			setReduceMotion(await getReduceMotionEnabled());
			setAppReady(true);
			await SplashScreen.hideAsync();
		})();
	}, []);

	const onSplashFinish = useCallback(() => {
		setShowAnimatedSplash(false);
	}, []);

	if (!appReady) {
		return null;
	}

	return (
		<QueryClientProvider client={queryClient}>
			<View style={styles.root}>
				<ThemeProvider value={colorScheme === "dark" ? NavigationDarkTheme : NavigationLightTheme}>
					<Stack>
						<Stack.Screen name="index" options={{ headerShown: false }} />
					</Stack>
					<StatusBar style="auto" />
				</ThemeProvider>
				{showAnimatedSplash ? (
					<AnimatedSplash onFinish={onSplashFinish} reduceMotion={reduceMotion} />
				) : null}
			</View>
		</QueryClientProvider>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
});

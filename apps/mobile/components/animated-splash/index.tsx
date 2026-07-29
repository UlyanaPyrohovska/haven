import { useCallback, useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Colors } from "@/constants/app-config";
import { HavenSplashWebView } from "./haven-splash-webview";

const FADE_MS = 350;

type AnimatedSplashProps = {
	onFinish: () => void;
	reduceMotion: boolean;
};

export function AnimatedSplash({ onFinish, reduceMotion }: AnimatedSplashProps) {
	const opacity = useSharedValue(1);
	const finishedRef = useRef(false);

	const finish = useCallback(() => {
		if (finishedRef.current) return;
		finishedRef.current = true;
		opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
			if (done) runOnJS(onFinish)();
		});
	}, [onFinish, opacity]);

	useEffect(() => {
		if (reduceMotion) {
			const timeout = setTimeout(finish, 300);
			return () => clearTimeout(timeout);
		}
	}, [finish, reduceMotion]);

	const overlayStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	return (
		<Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="box-none">
			<HavenSplashWebView reduceMotion={reduceMotion} onComplete={finish} />
		</Animated.View>
	);
}

export async function getReduceMotionEnabled() {
	return AccessibilityInfo.isReduceMotionEnabled();
}

export { HavenSplashWebView } from "./haven-splash-webview";

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: Colors.brand.splash,
		zIndex: 100,
	},
});

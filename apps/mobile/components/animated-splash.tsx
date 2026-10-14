import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	runOnJS,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { HAVEN_MARK, markPath } from "@/components/haven-logo";
import { Colors } from "@/constants/app-config";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MARK_WIDTH = 160;
const MARK_HEIGHT = (MARK_WIDTH * HAVEN_MARK.height) / HAVEN_MARK.width;

const polylineLength = (points: readonly (readonly [number, number])[]) =>
	points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);

const CHEVRON = { d: markPath(HAVEN_MARK.chevron), length: polylineLength(HAVEN_MARK.chevron) };
const STEM = { d: markPath(HAVEN_MARK.stem), length: polylineLength(HAVEN_MARK.stem) };

const DRAW_EASING = Easing.out(Easing.cubic);
const REDUCED_HOLD_MS = 400;
const REDUCED_FADE_MS = 300;

type AnimatedSplashProps = {
	onFinish: () => void;
	reduceMotion: boolean;
};

/**
 * JS overlay that takes over from the native splash (plain honey, no image) and draws the mark in:
 * chevron 0.1–0.6s, stem 0.6–0.85s, then scale-up + fade 0.9–1.3s.
 */
export function AnimatedSplash({ onFinish, reduceMotion }: AnimatedSplashProps) {
	// Reduce Motion starts fully drawn; otherwise fully hidden.
	const chevron = useSharedValue(reduceMotion ? 1 : 0);
	const stem = useSharedValue(reduceMotion ? 1 : 0);
	const scale = useSharedValue(1);
	const opacity = useSharedValue(1);
	const started = useRef(false);

	useEffect(
		() => () => {
			cancelAnimation(chevron);
			cancelAnimation(stem);
			cancelAnimation(scale);
			cancelAnimation(opacity);
		},
		[chevron, stem, scale, opacity],
	);

	const onFirstLayout = () => {
		if (started.current) return;
		started.current = true;
		// The overlay now covers the screen with the same colour, so the native splash can go.
		void SplashScreen.hideAsync();

		const done = (finished?: boolean) => {
			"worklet";
			if (finished) runOnJS(onFinish)();
		};

		if (reduceMotion) {
			opacity.set(withDelay(REDUCED_HOLD_MS, withTiming(0, { duration: REDUCED_FADE_MS }, done)));
			return;
		}

		chevron.set(withDelay(100, withTiming(1, { duration: 500, easing: DRAW_EASING })));
		stem.set(withDelay(600, withTiming(1, { duration: 250, easing: DRAW_EASING })));
		scale.set(withDelay(900, withTiming(1.15, { duration: 400, easing: DRAW_EASING })));
		opacity.set(withDelay(900, withTiming(0, { duration: 400 }, done)));
	};

	const chevronProps = useAnimatedProps(() => ({ strokeDashoffset: CHEVRON.length * (1 - chevron.value) }));
	const stemProps = useAnimatedProps(() => ({ strokeDashoffset: STEM.length * (1 - stem.value) }));
	const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
	const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

	return (
		<Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" onLayout={onFirstLayout}>
			<Animated.View style={markStyle}>
				<Svg width={MARK_WIDTH} height={MARK_HEIGHT} viewBox={`0 0 ${HAVEN_MARK.width} ${HAVEN_MARK.height}`}>
					{[
						{ path: CHEVRON, animatedProps: chevronProps },
						{ path: STEM, animatedProps: stemProps },
					].map(({ path, animatedProps }) => (
						<AnimatedPath
							key={path.d}
							d={path.d}
							stroke={Colors.brand.white}
							strokeWidth={HAVEN_MARK.strokeWidth}
							strokeLinejoin="miter"
							fill="none"
							strokeDasharray={[path.length, path.length]}
							animatedProps={animatedProps}
						/>
					))}
				</Svg>
			</Animated.View>
		</Animated.View>
	);
}

export async function getReduceMotionEnabled() {
	return AccessibilityInfo.isReduceMotionEnabled();
}

const styles = StyleSheet.create({
	overlay: {
		...StyleSheet.absoluteFill,
		backgroundColor: Colors.brand.splash,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 100,
	},
});

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withSequence,
	withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/app-config";

export type DecisionKind = "accept" | "decline";

type DecisionOverlayProps = {
	kind: DecisionKind | null;
	onFinished: () => void;
};

/** Accept: soft golden rings. Decline: card fades down and away — no swipe, no veil. */
export function DecisionOverlay({ kind, onFinished }: DecisionOverlayProps) {
	const ringOne = useSharedValue(0);
	const ringTwo = useSharedValue(0);
	const flash = useSharedValue(0);
	const timer = useSharedValue(0);

	useEffect(() => {
		if (kind === "accept") {
			ringOne.value = 0;
			ringTwo.value = 0;
			flash.value = 0;
			ringOne.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }, (finished) => {
				if (finished) runOnJS(onFinished)();
			});
			ringTwo.value = withDelay(140, withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) }));
			flash.value = withSequence(
				withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
				withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }),
			);
			return;
		}

		if (kind === "decline") {
			timer.value = 0;
			timer.value = withTiming(1, { duration: DECLINE_MS }, (finished) => {
				if (finished) runOnJS(onFinished)();
			});
		}
	}, [flash, kind, onFinished, ringOne, ringTwo, timer]);

	// Fade rings in over the first 15% so they never pop at full opacity.
	const ringOneStyle = useAnimatedStyle(() => ({
		opacity: Math.min(1, ringOne.value / 0.15) * (1 - ringOne.value),
		transform: [{ scale: 0.6 + ringOne.value * 1.8 }],
	}));

	const ringTwoStyle = useAnimatedStyle(() => ({
		opacity: 0.7 * Math.min(1, ringTwo.value / 0.15) * (1 - ringTwo.value),
		transform: [{ scale: 0.4 + ringTwo.value * 2.4 }],
	}));

	const flashStyle = useAnimatedStyle(() => ({
		opacity: 0.25 * flash.value,
	}));

	if (kind !== "accept") {
		return null;
	}

	return (
		<View pointerEvents="none" style={styles.root}>
			<Animated.View style={[styles.flash, flashStyle]} />
			<Animated.View style={[styles.ring, ringOneStyle]} />
			<Animated.View style={[styles.ring, styles.ringInner, ringTwoStyle]} />
		</View>
	);
}

const DECLINE_MS = 380;

/** Card entrance once `ready`, then accept/decline exit. */
export function useDecisionCardStyle(kind: DecisionKind | null, ready: boolean) {
	const cardScale = useSharedValue(0.97);
	const cardOpacity = useSharedValue(0);
	const cardTranslateY = useSharedValue(12);

	useEffect(() => {
		if (!ready) {
			return;
		}

		const easing = Easing.out(Easing.cubic);
		cardOpacity.value = withTiming(1, { duration: 320, easing });
		cardScale.value = withTiming(1, { duration: 360, easing });
		cardTranslateY.value = withTiming(0, { duration: 360, easing });
	}, [cardOpacity, cardScale, cardTranslateY, ready]);

	useEffect(() => {
		if (kind === "accept") {
			cardScale.value = withTiming(1.03, { duration: 360, easing: Easing.out(Easing.cubic) });
			cardOpacity.value = withDelay(200, withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) }));
			return;
		}

		if (kind === "decline") {
			const easing = Easing.in(Easing.cubic);
			cardScale.value = withTiming(0.96, { duration: DECLINE_MS, easing });
			cardTranslateY.value = withTiming(24, { duration: DECLINE_MS, easing });
			cardOpacity.value = withTiming(0, { duration: DECLINE_MS, easing });
		}
	}, [cardOpacity, cardScale, cardTranslateY, kind]);

	return useAnimatedStyle(() => ({
		opacity: cardOpacity.value,
		transform: [{ translateY: cardTranslateY.value }, { scale: cardScale.value }],
	}));
}

const styles = StyleSheet.create({
	root: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
	},
	flash: {
		...StyleSheet.absoluteFill,
		backgroundColor: Colors.palette.honeySoft,
	},
	ring: {
		position: "absolute",
		width: 160,
		height: 160,
		borderRadius: 999,
		borderWidth: 3,
		borderColor: Colors.palette.honey,
	},
	ringInner: {
		borderColor: Colors.palette.honeyLight,
	},
});

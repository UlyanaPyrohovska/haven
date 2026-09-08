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

/** Accept: expanding golden rings. Decline: card folds away — no swipe. */
export function DecisionOverlay({ kind, onFinished }: DecisionOverlayProps) {
	const ringOne = useSharedValue(0);
	const ringTwo = useSharedValue(0);
	const flash = useSharedValue(0);
	const fold = useSharedValue(0);

	useEffect(() => {
		if (kind !== "accept") {
			return;
		}

		ringOne.value = 0;
		ringTwo.value = 0;
		flash.value = 0;
		ringOne.value = withSequence(
			withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
			withTiming(1, { duration: 0 }, () => {
				runOnJS(onFinished)();
			}),
		);
		ringTwo.value = withDelay(
			120,
			withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }),
		);
		flash.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
	}, [flash, kind, onFinished, ringOne, ringTwo]);

	useEffect(() => {
		if (kind !== "decline") {
			return;
		}

		fold.value = 0;
		fold.value = withSequence(
			withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }),
			withTiming(1, { duration: 0 }, () => {
				runOnJS(onFinished)();
			}),
		);
	}, [fold, kind, onFinished]);

	const ringOneStyle = useAnimatedStyle(() => ({
		opacity: 1 - ringOne.value,
		transform: [{ scale: 0.4 + ringOne.value * 2.2 }],
	}));

	const ringTwoStyle = useAnimatedStyle(() => ({
		opacity: 0.7 * (1 - ringTwo.value),
		transform: [{ scale: 0.2 + ringTwo.value * 2.8 }],
	}));

	const flashStyle = useAnimatedStyle(() => ({
		opacity: 0.35 * (1 - flash.value),
	}));

	const foldStyle = useAnimatedStyle(() => ({
		opacity: fold.value * 0.25,
	}));

	if (!kind) {
		return null;
	}

	if (kind === "accept") {
		return (
			<View pointerEvents="none" style={styles.root}>
				<Animated.View style={[styles.flash, flashStyle]} />
				<Animated.View style={[styles.ring, ringOneStyle]} />
				<Animated.View style={[styles.ring, styles.ringInner, ringTwoStyle]} />
			</View>
		);
	}

	return (
		<View pointerEvents="none" style={styles.root}>
			<Animated.View style={[styles.foldVeil, foldStyle]} />
		</View>
	);
}

export function useDecisionCardStyle(kind: DecisionKind | null) {
	const cardScale = useSharedValue(1);
	const cardOpacity = useSharedValue(1);
	const cardRotate = useSharedValue(0);

	useEffect(() => {
		if (kind === "accept") {
			cardScale.value = 1;
			cardOpacity.value = 1;
			cardRotate.value = 0;
			cardScale.value = withTiming(1.04, { duration: 320, easing: Easing.out(Easing.cubic) });
			cardOpacity.value = withDelay(180, withTiming(0, { duration: 360 }));
			return;
		}

		if (kind === "decline") {
			cardScale.value = 1;
			cardOpacity.value = 1;
			cardRotate.value = 0;
			cardRotate.value = withTiming(-8, { duration: 420, easing: Easing.inOut(Easing.cubic) });
			cardScale.value = withTiming(0.88, { duration: 420, easing: Easing.inOut(Easing.cubic) });
			cardOpacity.value = withTiming(0, { duration: 420 });
		}
	}, [cardOpacity, cardRotate, cardScale, kind]);

	return useAnimatedStyle(() => ({
		opacity: cardOpacity.value,
		transform: [{ scale: cardScale.value }, { rotate: `${cardRotate.value}deg` }],
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
	foldVeil: {
		...StyleSheet.absoluteFill,
		backgroundColor: Colors.brand.ink,
	},
});

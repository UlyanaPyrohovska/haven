import { useRef } from "react";
import { type DimensionValue, type LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { IMPORTANCE_MAX, IMPORTANCE_MIN } from "@/constants/profile-taxonomy";
import { useTheme } from "@/hooks/use-theme";

export type SliderScaleProps = {
	label: string;
	/** `undefined` leaves the slider unset, which the steps treat as unanswered. */
	value: number | undefined;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
};

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 8;
const GESTURE_HEIGHT = 40;

/** Movement under this many points still counts as a tap rather than a drag. */
const TAP_SLOP = 4;

/**
 * Draggable discrete slider backing the `pref_*` importance and `self_*` rating steps.
 * Built on `PanResponder` so it needs no gesture-handler root and snaps to whole steps.
 */
export function SliderScale({ label, value, onChange, min = IMPORTANCE_MIN, max = IMPORTANCE_MAX }: SliderScaleProps) {
	const theme = useTheme();

	// The responder is created once, so everything it reads lives in refs.
	const trackWidth = useRef(0);
	const trackOrigin = useRef(0);
	const touchOffset = useRef(0);
	const dragging = useRef(false);
	const latest = useRef({ value, onChange, min, max });
	latest.current = { value, onChange, min, max };

	const setFromOffset = (offsetX: number) => {
		const current = latest.current;
		const width = trackWidth.current;

		if (width <= 0) {
			return;
		}

		const ratio = Math.min(Math.max(offsetX / width, 0), 1);
		const next = current.min + Math.round(ratio * (current.max - current.min));

		if (next !== current.value) {
			current.onChange(next);
		}
	};

	const responder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			// Lets the surrounding ScrollView win once it recognises a vertical scroll, so a
			// screen full of sliders is still scrollable.
			onPanResponderTerminationRequest: () => true,
			onPanResponderGrant: ({ nativeEvent }) => {
				// pageX minus locationX gives the track's left edge in page coordinates,
				// which subsequent moves are measured against.
				trackOrigin.current = nativeEvent.pageX - nativeEvent.locationX;
				touchOffset.current = nativeEvent.locationX;
				dragging.current = false;
			},
			onPanResponderMove: (_event, gesture) => {
				// Holding off until the gesture is clearly horizontal keeps a scroll that
				// happens to start on a slider from nudging its value.
				if (!dragging.current) {
					const isHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy);

					if (!isHorizontal || Math.abs(gesture.dx) <= TAP_SLOP) {
						return;
					}

					dragging.current = true;
				}

				setFromOffset(gesture.moveX - trackOrigin.current);
			},
			onPanResponderRelease: () => {
				if (!dragging.current) {
					setFromOffset(touchOffset.current);
				}

				dragging.current = false;
			},
			onPanResponderTerminate: () => {
				dragging.current = false;
			},
		}),
	).current;

	const onLayout = (event: LayoutChangeEvent) => {
		trackWidth.current = event.nativeEvent.layout.width;
	};

	const ratio = value === undefined ? 0 : (value - min) / (max - min);
	const offset = `${ratio * 100}%` as DimensionValue;
	const isSet = value !== undefined;

	const step = (delta: number) => {
		const next = Math.min(Math.max((value ?? min) + delta, min), max);

		if (next !== value) {
			onChange(next);
		}
	};

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<ThemedText type="label">{label}</ThemedText>
				<ThemedText type="caption" style={{ color: isSet ? theme.muted : theme.placeholder }}>
					{isSet ? `${value}/${max}` : "–"}
				</ThemedText>
			</View>

			<View style={styles.padding}>
				<View
					style={styles.gestureArea}
					onLayout={onLayout}
					accessibilityRole="adjustable"
					accessibilityLabel={label}
					accessibilityValue={{ min, max, now: value }}
					accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
					onAccessibilityAction={({ nativeEvent }) => {
						step(nativeEvent.actionName === "increment" ? 1 : -1);
					}}
					{...responder.panHandlers}
				>
					<View style={[styles.track, { backgroundColor: theme.track }]} />
					<View style={[styles.track, styles.fill, { width: offset, backgroundColor: theme.tint }]} />
					<View
						style={[
							styles.thumb,
							{
								left: offset,
								backgroundColor: isSet ? theme.tint : theme.track,
								borderColor: theme.background,
							},
						]}
					/>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.xs,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	// Keeps the thumb inside the row at either end of the track.
	padding: {
		paddingHorizontal: THUMB_SIZE / 2,
	},
	gestureArea: {
		height: GESTURE_HEIGHT,
		justifyContent: "center",
	},
	track: {
		height: TRACK_HEIGHT,
		borderRadius: Radius.pill,
	},
	fill: {
		position: "absolute",
		left: 0,
	},
	thumb: {
		position: "absolute",
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		marginLeft: -THUMB_SIZE / 2,
		borderRadius: Radius.pill,
		borderWidth: 2,
	},
});

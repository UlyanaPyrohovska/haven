import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { type DimensionValue, type LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

export type Range = { min: number; max: number };

export type RangeSliderProps = {
	label: string;
	value: Range;
	onChange: (value: Range) => void;
	min: number;
	max: number;
	emoji?: string;
	/** Header text for the current range, e.g. "25–35". Defaults to `min–max`. */
	formatValue?: (value: Range) => string;
	/** Screen-reader names for the two thumbs. */
	lowLabel: string;
	highLabel: string;
};

type Handle = "min" | "max";

const THUMB_SIZE = 28;
const THUMB_ACTIVE_SCALE = 1.25;
const TRACK_HEIGHT = 8;
const GESTURE_HEIGHT = 40;

/** Movement under this many points still counts as a tap rather than a drag. */
const TAP_SLOP = 4;

/**
 * Two-thumb version of `SliderScale` for picking an inclusive range (the partner age filter).
 * Same gesture model: the closest thumb follows the finger, vertical scrolls fall through.
 */
export function RangeSlider({
	label,
	value,
	onChange,
	min,
	max,
	emoji,
	formatValue,
	lowLabel,
	highLabel,
}: RangeSliderProps) {
	const theme = useTheme();
	const [activeHandle, setActiveHandle] = useState<Handle | null>(null);

	// The responder is created once, so everything it reads lives in refs.
	const trackWidth = useRef(0);
	const trackOrigin = useRef(0);
	const touchOffset = useRef(0);
	const dragging = useRef(false);
	const handle = useRef<Handle>("min");
	const latest = useRef({ value, onChange, min, max });
	latest.current = { value, onChange, min, max };

	const valueAt = (offsetX: number) => {
		const current = latest.current;
		const ratio = Math.min(Math.max(offsetX / trackWidth.current, 0), 1);

		return current.min + Math.round(ratio * (current.max - current.min));
	};

	const setHandle = (which: Handle, next: number) => {
		const current = latest.current;
		// Thumbs may meet but never cross, so min ≤ max always holds.
		const clamped =
			which === "min"
				? { min: Math.min(Math.max(next, current.min), current.value.max), max: current.value.max }
				: { min: current.value.min, max: Math.max(Math.min(next, current.max), current.value.min) };

		if (clamped.min !== current.value.min || clamped.max !== current.value.max) {
			void Haptics.selectionAsync();
			current.onChange(clamped);
		}
	};

	const closestHandle = (offsetX: number): Handle => {
		const target = valueAt(offsetX);
		const { value: range } = latest.current;

		if (target <= range.min) {
			return "min";
		}

		if (target >= range.max) {
			return "max";
		}

		return target - range.min <= range.max - target ? "min" : "max";
	};

	const responder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderTerminationRequest: () => !dragging.current,
			onPanResponderGrant: ({ nativeEvent }) => {
				trackOrigin.current = nativeEvent.pageX - nativeEvent.locationX;
				touchOffset.current = nativeEvent.locationX;
				dragging.current = false;
				handle.current = closestHandle(nativeEvent.locationX);
				setActiveHandle(handle.current);
			},
			onPanResponderMove: (_event, gesture) => {
				if (!dragging.current) {
					const isHorizontal = Math.abs(gesture.dx) > Math.abs(gesture.dy);

					if (!isHorizontal || Math.abs(gesture.dx) <= TAP_SLOP) {
						return;
					}

					dragging.current = true;

					// Stacked thumbs: the drag direction decides which one moves.
					const { value: range } = latest.current;

					if (range.min === range.max) {
						handle.current = gesture.dx > 0 ? "max" : "min";
						setActiveHandle(handle.current);
					}
				}

				if (trackWidth.current > 0) {
					setHandle(handle.current, valueAt(gesture.moveX - trackOrigin.current));
				}
			},
			onPanResponderRelease: () => {
				if (!dragging.current && trackWidth.current > 0) {
					setHandle(handle.current, valueAt(touchOffset.current));
				}

				dragging.current = false;
				setActiveHandle(null);
			},
			onPanResponderTerminate: () => {
				dragging.current = false;
				setActiveHandle(null);
			},
		}),
	).current;

	const onLayout = (event: LayoutChangeEvent) => {
		trackWidth.current = event.nativeEvent.layout.width;
	};

	const percent = (n: number) => `${((n - min) / (max - min)) * 100}%` as DimensionValue;
	const minRatio = (value.min - min) / (max - min);
	const maxRatio = (value.max - min) / (max - min);

	const renderThumb = (which: Handle) => {
		const thumbValue = value[which];

		return (
			<View
				key={which}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={which === "min" ? lowLabel : highLabel}
				accessibilityValue={{ min, max, now: thumbValue }}
				accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
				onAccessibilityAction={({ nativeEvent }) => {
					setHandle(which, thumbValue + (nativeEvent.actionName === "increment" ? 1 : -1));
				}}
				style={[
					styles.thumb,
					{
						left: percent(thumbValue),
						backgroundColor: theme.tint,
						borderColor: theme.background,
						transform: [{ scale: activeHandle === which ? THUMB_ACTIVE_SCALE : 1 }],
					},
				]}
			/>
		);
	};

	return (
		<View
			style={[
				styles.root,
				{ backgroundColor: theme.accentSoft, borderColor: activeHandle ? theme.tint : theme.border },
			]}
		>
			<View style={styles.header}>
				<ThemedText type="label">{emoji ? `${emoji}  ${label}` : label}</ThemedText>
				<ThemedText type="caption" style={{ color: theme.tint }}>
					{formatValue ? formatValue(value) : `${value.min}–${value.max}`}
				</ThemedText>
			</View>

			<View style={styles.padding}>
				<View style={styles.gestureArea} onLayout={onLayout} {...responder.panHandlers}>
					<View style={[styles.track, { backgroundColor: theme.track }]} />
					<View
						style={[
							styles.track,
							styles.fill,
							{
								left: `${minRatio * 100}%`,
								width: `${(maxRatio - minRatio) * 100}%`,
								backgroundColor: theme.tint,
							},
						]}
					/>
					{renderThumb("min")}
					{renderThumb("max")}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		gap: Spacing.xs,
		padding: Spacing.md,
		borderRadius: Radius.lg,
		borderWidth: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.sm,
	},
	// Keeps the thumbs inside the row at either end of the track.
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

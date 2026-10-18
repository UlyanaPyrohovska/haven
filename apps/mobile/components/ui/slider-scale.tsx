import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
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
	/** Shown before the label to give each trait a bit of personality. */
	emoji?: string;
	/** Words spread evenly across the range, shown instead of `value/max` (e.g. "Not at all" … "Essential"). */
	levels?: readonly string[];
};

const THUMB_SIZE = 28;
const THUMB_ACTIVE_SCALE = 1.25;
const TICK_SIZE = 4;
const TRACK_HEIGHT = 8;
const GESTURE_HEIGHT = 40;

/** Movement under this many points still counts as a tap rather than a drag. */
const TAP_SLOP = 4;

/**
 * Draggable discrete slider backing the `pref_*` importance and `self_*` rating steps.
 * Built on `PanResponder` so it needs no gesture-handler root and snaps to whole steps.
 */
export function SliderScale({
	label,
	value,
	onChange,
	min = IMPORTANCE_MIN,
	max = IMPORTANCE_MAX,
	emoji,
	levels,
}: SliderScaleProps) {
	const theme = useTheme();
	const [active, setActive] = useState(false);

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
			void Haptics.selectionAsync();
			current.onChange(next);
		}
	};

	const responder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			// Lets the surrounding ScrollView win once it recognises a vertical scroll, so a
			// screen full of sliders is still scrollable. A horizontal drag already under way keeps the touch.
			onPanResponderTerminationRequest: () => !dragging.current,
			onPanResponderGrant: ({ nativeEvent }) => {
				// pageX minus locationX gives the track's left edge in page coordinates,
				// which subsequent moves are measured against.
				trackOrigin.current = nativeEvent.pageX - nativeEvent.locationX;
				touchOffset.current = nativeEvent.locationX;
				dragging.current = false;
				setActive(true);
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
				setActive(false);
			},
			onPanResponderTerminate: () => {
				dragging.current = false;
				setActive(false);
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
			void Haptics.selectionAsync();
			onChange(next);
		}
	};

	const level = isSet && levels?.length ? levels[Math.round(ratio * (levels.length - 1))] : undefined;
	const ticks = Array.from({ length: max - min + 1 }, (_, index) => min + index);

	return (
		<View
			style={[
				styles.root,
				{ backgroundColor: isSet ? theme.accentSoft : theme.surface, borderColor: active ? theme.tint : theme.border },
			]}
		>
			<View style={styles.header}>
				<ThemedText type="label">{emoji ? `${emoji}  ${label}` : label}</ThemedText>
				<ThemedText type="caption" style={{ color: isSet ? theme.tint : theme.placeholder }}>
					{isSet ? (level ?? `${value}/${max}`) : "–"}
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
					{ticks.map((tick) => (
						<View
							key={tick}
							style={[
								styles.tick,
								{
									left: `${((tick - min) / (max - min)) * 100}%` as DimensionValue,
									backgroundColor: isSet && tick <= value ? theme.onTint : theme.border,
								},
							]}
						/>
					))}
					<View
						style={[
							styles.thumb,
							{
								left: offset,
								backgroundColor: isSet ? theme.tint : theme.track,
								borderColor: theme.background,
								transform: [{ scale: active ? THUMB_ACTIVE_SCALE : 1 }],
							},
						]}
					>
						{isSet ? (
							<ThemedText type="caption" style={[styles.thumbValue, { color: theme.onTint }]}>
								{value}
							</ThemedText>
						) : null}
					</View>
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
		alignItems: "center",
		justifyContent: "center",
	},
	thumbValue: {
		fontWeight: "700",
		lineHeight: 16,
	},
	tick: {
		position: "absolute",
		width: TICK_SIZE,
		height: TICK_SIZE,
		marginLeft: -TICK_SIZE / 2,
		borderRadius: Radius.pill,
	},
});

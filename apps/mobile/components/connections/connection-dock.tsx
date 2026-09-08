import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

const DOCK = {
	arcHeight: 56,
	buttonSize: 56,
	centerSize: 72,
	centerLift: 24,
} as const;

export type ConnectionDockProps = {
	bottomInset: number;
	onAccept: () => void;
	onDecline: () => void;
	onMessage: () => void;
	disabled?: boolean;
};

export function ConnectionDock({
	bottomInset,
	onAccept,
	onDecline,
	onMessage,
	disabled = false,
}: ConnectionDockProps) {
	const theme = useTheme();
	const { width } = useWindowDimensions();
	const totalHeight = DOCK.arcHeight + bottomInset;

	const path = `M 0 ${DOCK.arcHeight} A ${width / 2} ${DOCK.arcHeight} 0 0 1 ${width} ${DOCK.arcHeight} L ${width} ${totalHeight} L 0 ${totalHeight} Z`;

	return (
		<View pointerEvents="box-none" style={styles.root}>
			<View style={[styles.shadow, { shadowColor: theme.tint }]}>
				<Svg width={width} height={totalHeight}>
					<Path
						d={path}
						fill={theme.surface}
						stroke={theme.border}
						strokeWidth={StyleSheet.hairlineWidth}
					/>
				</Svg>
			</View>

			<View style={[styles.actions, { bottom: bottomInset + Spacing.lg }]}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Accept"
					disabled={disabled}
					onPress={onAccept}
					style={({ pressed }) => [
						styles.sideButton,
						{ backgroundColor: theme.tint, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
					]}
				>
					<Ionicons name="checkmark" size={26} color={theme.onTint} />
				</Pressable>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Message"
					disabled={disabled}
					onPress={onMessage}
					style={({ pressed }) => [
						styles.centerButton,
						{ backgroundColor: theme.text, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
					]}
				>
					<Ionicons name="chatbubble-ellipses" size={28} color={theme.background} />
				</Pressable>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Decline"
					disabled={disabled}
					onPress={onDecline}
					style={({ pressed }) => [
						styles.sideButton,
						{ backgroundColor: theme.text, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
					]}
				>
					<Ionicons name="close" size={26} color={theme.background} />
				</Pressable>
			</View>
		</View>
	);
}

export const connectionDockClearance = DOCK.arcHeight + DOCK.centerSize / 2 + DOCK.centerLift + Spacing.xl;

const styles = StyleSheet.create({
	root: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
	},
	shadow: {
		width: "100%",
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.15,
		shadowRadius: 10,
		elevation: 8,
	},
	actions: {
		position: "absolute",
		left: 0,
		right: 0,
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
		gap: Spacing.xxl,
	},
	sideButton: {
		width: DOCK.buttonSize,
		height: DOCK.buttonSize,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	centerButton: {
		width: DOCK.centerSize,
		height: DOCK.centerSize,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: DOCK.centerLift,
		elevation: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 8,
	},
});

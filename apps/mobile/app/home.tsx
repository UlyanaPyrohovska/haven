import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { Colors, FontFamily, FontSize, Radius, Spacing } from "@/constants/app-config";
import { Strings } from "@/constants/strings";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";
import { signOut, useSession } from "@/lib/auth-client";

/** Placeholder content until profile and feed APIs are wired up. */
const DUMMY = {
	location: "Setúbal, Portugal",
	newConnections: 5,
	unreadMessages: 5,
	dailyQuestion: "What made you smile this week?",
} as const;

/** Semi-ellipse dome: flat bottom, curved top, full screen width — matches the wireframe. */
const DOCK = {
	arcHeight: 56,
	fabSize: 72,
	fabLift: 28,
} as const;

function dockColors(scheme: "light" | "dark" | null | undefined) {
	if (scheme === "dark") {
		return {
			fill: "#2e3234",
			border: "#454a4d",
			shadow: "rgba(0, 0, 0, 0.35)",
		};
	}

	return {
		fill: Colors.light.surface,
		border: Colors.light.border,
		shadow: "rgba(0, 0, 0, 0.08)",
	};
}

type BottomDockProps = {
	width: number;
	bottomInset: number;
	fill: string;
	border: string;
	shadow: string;
	unreadCount: number;
};

function BottomDock({ width, bottomInset, fill, border, shadow, unreadCount }: BottomDockProps) {
	const totalHeight = DOCK.arcHeight + bottomInset;

	// Semi-ellipse arc peaking at y = 0, baseline at y = arcHeight.
	const path = `M 0 ${DOCK.arcHeight} A ${width / 2} ${DOCK.arcHeight} 0 0 1 ${width} ${DOCK.arcHeight} L ${width} ${totalHeight} L 0 ${totalHeight} Z`;

	return (
		<View pointerEvents="box-none" style={styles.bottomDock}>
			<View style={[styles.dockShadow, { shadowColor: shadow }]}>
				<Svg width={width} height={totalHeight}>
					<Path d={path} fill={fill} stroke={border} strokeWidth={StyleSheet.hairlineWidth} />
				</Svg>
			</View>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Messages"
				style={({ pressed }) => [
					styles.fab,
					{
						bottom: bottomInset + DOCK.fabLift,
						backgroundColor: Colors.brand.ink,
						opacity: pressed ? 0.9 : 1,
					},
				]}
			>
				<Ionicons name="chatbubble-ellipses" size={28} color={Colors.brand.white} />
				<View style={[styles.fabBadge, { backgroundColor: fill, borderColor: border }]}>
					<ThemedText type="caption" style={styles.fabBadgeText}>
						{unreadCount}
					</ThemedText>
				</View>
			</Pressable>
		</View>
	);
}

export default function HomeScreen() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const theme = useTheme();
	const colorScheme = useColorScheme();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { data: session } = useSession();
	const [response, setResponse] = useState("");

	const dock = dockColors(colorScheme);
	const displayName = session?.user.name?.split(" ")[0] ?? "Uliana";
	const initials = displayName.slice(0, 1).toUpperCase();
	const dockClearance = DOCK.arcHeight + DOCK.fabSize / 2 + DOCK.fabLift + Spacing.lg;

	const onSignOut = async () => {
		await signOut();
		queryClient.clear();
		router.replace("/login");
	};

	return (
		<View style={[styles.root, { backgroundColor: theme.background }]}>
			<ScrollView
				contentContainerStyle={[
					styles.scrollContent,
					{
						paddingTop: insets.top + Spacing.md,
						paddingBottom: insets.bottom + dockClearance,
					},
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={Strings.common.signOut}
						hitSlop={Spacing.sm}
						onPress={onSignOut}
						style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
					>
						<Ionicons name="options-outline" size={24} color={theme.text} />
					</Pressable>

					<View style={[styles.locationPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<Ionicons name="eye-off-outline" size={14} color={theme.icon} />
						<ThemedText type="caption" style={styles.locationText}>
							{DUMMY.location}
						</ThemedText>
					</View>

					<View style={[styles.avatar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<ThemedText type="subtitle">{initials}</ThemedText>
					</View>
				</View>

				<ThemedText type="title" style={styles.greeting}>
					{Strings.home.greeting(displayName)}
				</ThemedText>

				<View style={styles.connectionsBlock}>
					<View style={[styles.connectionsCircle, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<ThemedText style={styles.connectionsCount}>{DUMMY.newConnections}</ThemedText>
					</View>
					<ThemedText type="label" style={{ color: theme.muted }}>
						{Strings.home.newConnections}
					</ThemedText>
				</View>

				<Pressable
					style={({ pressed }) => [
						styles.moodCard,
						{
							backgroundColor: theme.surface,
							borderColor: theme.border,
							opacity: pressed ? 0.85 : 1,
						},
					]}
				>
					<ThemedText type="subtitle" style={styles.moodPrompt}>
						{Strings.home.moodPrompt}
					</ThemedText>
				</Pressable>

				<View style={styles.questionSection}>
					<ThemedText type="label">{Strings.home.todaysQuestion}</ThemedText>
					<ThemedText style={[styles.questionQuote, { color: theme.muted }]}>{`"${DUMMY.dailyQuestion}"`}</ThemedText>

					<TextInput
						value={response}
						onChangeText={setResponse}
						placeholder={Strings.home.responsePlaceholder}
						placeholderTextColor={theme.placeholder}
						selectionColor={theme.tint}
						multiline
						style={[
							styles.responseInput,
							{
								backgroundColor: theme.field,
								color: theme.text,
								borderColor: theme.border,
							},
						]}
					/>
				</View>
			</ScrollView>

			<BottomDock
				width={width}
				bottomInset={insets.bottom}
				fill={dock.fill}
				border={dock.border}
				shadow={dock.shadow}
				unreadCount={DUMMY.unreadMessages}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: Spacing.xl,
		gap: Spacing.xl,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	iconButton: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	locationPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
	},
	locationText: {
		fontWeight: "500",
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	greeting: {
		marginTop: Spacing.sm,
	},
	connectionsBlock: {
		alignItems: "center",
		gap: Spacing.md,
		marginTop: Spacing.sm,
	},
	connectionsCircle: {
		width: 148,
		height: 148,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	connectionsCount: {
		fontSize: 56,
		lineHeight: 64,
		fontWeight: "600",
		fontFamily: FontFamily.body,
	},
	moodCard: {
		minHeight: 120,
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.xl,
	},
	moodPrompt: {
		textAlign: "center",
	},
	questionSection: {
		gap: Spacing.sm,
	},
	questionQuote: {
		fontSize: FontSize.md,
		lineHeight: 24,
		fontStyle: "italic",
	},
	responseInput: {
		marginTop: Spacing.sm,
		minHeight: 52,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		fontSize: FontSize.md,
		fontFamily: FontFamily.body,
	},
	bottomDock: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		alignItems: "center",
	},
	dockShadow: {
		width: "100%",
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 1,
		shadowRadius: 8,
		elevation: 8,
	},
	fab: {
		position: "absolute",
		alignSelf: "center",
		width: DOCK.fabSize,
		height: DOCK.fabSize,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
		elevation: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
	},
	fabBadge: {
		position: "absolute",
		top: -2,
		right: -2,
		minWidth: 22,
		height: 22,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.xs,
	},
	fabBadgeText: {
		fontWeight: "600",
		fontSize: 11,
		lineHeight: 14,
	},
});

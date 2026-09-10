import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Colors, FontFamily, FontSize, Radius, Spacing } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "react-i18next";
import { fetchRecommendations, recommendationsQueryKey } from "@/lib/api/recommendations";
import { useSession } from "@/lib/auth-client";

/** Placeholder content until profile and feed APIs are wired up. */
const DUMMY = {
	location: "Setúbal, Portugal",
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
			fill: Colors.dark.surface,
			border: Colors.dark.border,
			shadow: "rgba(0, 0, 0, 0.35)",
		};
	}

	return {
		fill: Colors.light.surface,
		border: Colors.light.border,
		shadow: "rgba(232, 146, 23, 0.12)",
	};
}

type BottomDockProps = {
	width: number;
	bottomInset: number;
	fill: string;
	border: string;
	shadow: string;
	unreadCount: number;
	fabColor: string;
	fabForeground: string;
	badgeBackground: string;
	badgeForeground: string;
	onMessagesPress?: () => void;
};

function BottomDock({
	width,
	bottomInset,
	fill,
	border,
	shadow,
	unreadCount,
	fabColor,
	fabForeground,
	badgeBackground,
	badgeForeground,
	onMessagesPress,
}: BottomDockProps) {
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
				onPress={onMessagesPress}
				style={({ pressed }) => [
					styles.fab,
					{
						bottom: bottomInset + DOCK.fabLift,
						backgroundColor: fabColor,
						opacity: pressed ? 0.9 : 1,
					},
				]}
			>
				<Ionicons name="chatbubble-ellipses" size={28} color={fabForeground} />
				<View style={[styles.fabBadge, { backgroundColor: badgeBackground, borderColor: border }]}>
					<ThemedText type="caption" style={[styles.fabBadgeText, { color: badgeForeground }]}>
						{unreadCount}
					</ThemedText>
				</View>
			</Pressable>
		</View>
	);
}

export default function HomeScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const theme = useTheme();
	const colorScheme = useColorScheme();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { data: session } = useSession();
	const recommendations = useQuery({
		queryKey: recommendationsQueryKey,
		queryFn: fetchRecommendations,
	});
	const [response, setResponse] = useState("");

	const dock = dockColors(colorScheme);
	const displayName = session?.user.name?.split(" ")[0] ?? "Uliana";
	const photoUrl = session?.user.image?.trim() || null;
	const newConnections = recommendations.data?.count ?? 0;
	const dailyQuestion = recommendations.data?.dailyQuestion ?? DUMMY.dailyQuestion;
	const dockClearance = DOCK.arcHeight + DOCK.fabSize / 2 + DOCK.fabLift + Spacing.lg;

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
				refreshControl={
					<RefreshControl
						refreshing={recommendations.isRefetching}
						onRefresh={() => recommendations.refetch()}
						tintColor={theme.tint}
						colors={[theme.tint]}
						progressViewOffset={insets.top}
					/>
				}
			>
				<View style={styles.header}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("home.settingsAccessibilityLabel")}
						hitSlop={Spacing.sm}
						onPress={() => router.push("/profile/settings")}
						style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
					>
						<Ionicons name="settings-outline" size={24} color={theme.text} />
					</Pressable>

					<View style={[styles.locationPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<Ionicons name="eye-off-outline" size={14} color={theme.icon} />
						<ThemedText type="caption" style={styles.locationText}>
							{DUMMY.location}
						</ThemedText>
					</View>

					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("home.profileAccessibilityLabel")}
						hitSlop={Spacing.sm}
						onPress={() => router.push("/profile")}
						style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
					>
						<UserAvatar imageUrl={photoUrl} name={session?.user.name ?? displayName} size={44} />
					</Pressable>
				</View>

				<ThemedText type="title" style={styles.greeting}>
					{t("home.greeting", { name: displayName })}
				</ThemedText>

				<Pressable
					accessibilityRole="button"
					onPress={() =>
						router.replace((newConnections > 0 ? "/connections" : "/matches") as Href)
					}
					style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
				>
					<View style={styles.connectionsBlock}>
						<View
							style={[
								styles.connectionsCircle,
								{ backgroundColor: theme.accentSoft, borderColor: theme.tint, borderWidth: 2 },
							]}
						>
							<ThemedText style={[styles.connectionsCount, { color: theme.tint }]}>
								{newConnections}
							</ThemedText>
						</View>
						<ThemedText type="label" style={{ color: theme.muted }}>
							{t("home.newConnections")}
						</ThemedText>
					</View>
				</Pressable>

				<Pressable
					style={({ pressed }) => [
						styles.moodCard,
						{
							backgroundColor: theme.accentSoft,
							borderColor: theme.tint,
							opacity: pressed ? 0.85 : 1,
						},
					]}
				>
					<ThemedText type="subtitle" style={styles.moodPrompt}>
						{t("home.moodPrompt")}
					</ThemedText>
				</Pressable>

				<View style={styles.questionSection}>
					<ThemedText type="label">{t("home.todaysQuestion")}</ThemedText>
					<ThemedText style={[styles.questionQuote, { color: theme.muted }]}>{`"${dailyQuestion}"`}</ThemedText>

					<TextInput
						value={response}
						onChangeText={setResponse}
						placeholder={t("home.responsePlaceholder")}
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
				fabColor={theme.tint}
				fabForeground={theme.onTint}
				badgeBackground={theme.background}
				badgeForeground={theme.tint}
				onMessagesPress={() => router.push("/matches" as Href)}
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

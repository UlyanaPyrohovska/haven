import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { NewMatchDialog } from "@/components/connections/new-match-dialog";
import { DailyQuestionCard } from "@/components/home/daily-question-card";
import { MoodCard } from "@/components/home/mood-card";
import { LocationPill } from "@/components/location/location-pill";
import { partnerFiltersSummary } from "@/components/profile/partner-filters";
import { UserAvatar } from "@/components/profile/user-avatar";
import { ThemedText } from "@/components/themed-text";
import { Colors, FontFamily, Radius, Spacing } from "@/constants/app-config";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useHeaderLocation } from "@/hooks/use-header-location";
import { useProfileQuery } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { todayDailyQuestionQueryKey } from "@/lib/api/daily-question";
import { todayMoodQueryKey } from "@/lib/api/mood";
import {
	fetchMatches,
	fetchRecommendations,
	matchesQueryKey,
	recommendationsQueryKey,
} from "@/lib/api/recommendations";
import { useSession } from "@/lib/auth/client";
import { useNotifications } from "@/lib/notifications";
import { readAgeRange, readInterestedIn } from "@/lib/profile/draft-from-record";

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
				{unreadCount > 0 ? (
					<View style={[styles.fabBadge, { backgroundColor: badgeBackground, borderColor: border }]}>
						<ThemedText type="caption" style={[styles.fabBadgeText, { color: badgeForeground }]}>
							{unreadCount > 99 ? "99+" : unreadCount}
						</ThemedText>
					</View>
				) : null}
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
	const queryClient = useQueryClient();
	const { data: session } = useSession();
	useNotifications();
	const hasSession = Boolean(session);
	const profile = useProfileQuery(hasSession);

	const recommendations = useQuery({
		queryKey: recommendationsQueryKey,
		queryFn: fetchRecommendations,
	});
	const [isFocused, setIsFocused] = useState(true);
	// Chat sockets are per-conversation, so home polls the inbox for the unread badge.
	// shortcut: 30s polling, upgrade to a per-user socket if the badge must be instant.
	const matches = useQuery({
		queryKey: matchesQueryKey,
		queryFn: fetchMatches,
		refetchInterval: isFocused ? 30_000 : false,
	});
	const refetchMatches = matches.refetch;
	useFocusEffect(
		useCallback(() => {
			setIsFocused(true);
			void refetchMatches();
			return () => setIsFocused(false);
		}, [refetchMatches]),
	);
	const unreadMessages = matches.data?.matches.reduce((sum, m) => sum + m.unreadCount, 0) ?? 0;
	const dock = dockColors(colorScheme);
	const headerLocation = useHeaderLocation(hasSession);
	const displayName = session?.user.name?.split(" ")[0] ?? "Uliana";
	const photoUrl = session?.user.image?.trim() || null;
	const newConnections = recommendations.data?.count ?? 0;
	const filtersSummary = profile.data
		? partnerFiltersSummary(readInterestedIn(profile.data.interestedIn), readAgeRange(profile.data))
		: null;
	const dockClearance = DOCK.arcHeight + DOCK.fabSize / 2 + DOCK.fabLift + Spacing.lg;
	const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
	// Only user pulls drive the spinner; background refetches flipping `refreshing` offscreen leave it stuck on iOS.
	const [isRefreshing, setIsRefreshing] = useState(false);
	const onRefresh = async () => {
		setIsRefreshing(true);
		try {
			await Promise.all([
				recommendations.refetch(),
				queryClient.invalidateQueries({ queryKey: todayMoodQueryKey }),
				queryClient.invalidateQueries({ queryKey: todayDailyQuestionQueryKey }),
				queryClient.invalidateQueries({ queryKey: matchesQueryKey }),
			]);
		} finally {
			setIsRefreshing(false);
		}
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
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={() => void onRefresh()}
						tintColor={theme.tint}
						colors={[theme.tint]}
						progressViewOffset={insets.top}
					/>
				}
			>
				<View style={styles.header}>
					<View style={styles.headerSide}>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("home.settingsAccessibilityLabel")}
							hitSlop={Spacing.sm}
							onPress={() => router.push("/profile/settings")}
							style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
						>
							<Ionicons name="settings-outline" size={24} color={theme.text} />
						</Pressable>
					</View>

					<View style={styles.headerCenter}>
						{headerLocation.visible ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t("profile.settingsScreen.location.title")}
								hitSlop={Spacing.sm}
								onPress={() => router.push("/profile/location-settings")}
								style={({ pressed }) => [styles.headerPillPressable, { opacity: pressed ? 0.75 : 1 }]}
							>
								<LocationPill
									label={headerLocation.label}
									hidden={headerLocation.hidden}
									unset={headerLocation.unset}
								/>
							</Pressable>
						) : null}
					</View>

					<View style={styles.headerSide}>
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
				</View>

				<View style={styles.greeting}>
					<ThemedText type="caption" style={[styles.date, { color: theme.muted }]}>
						{today}
					</ThemedText>
					<ThemedText type="title">{t("home.greeting", { name: displayName })}</ThemedText>
				</View>

				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("home.newConnections")}
					onPress={() => router.push((newConnections > 0 ? "/connections" : "/matches") as Href)}
					style={({ pressed }) => [
						styles.connectionsCard,
						{ backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
					]}
				>
					<View style={[styles.connectionsCircle, { backgroundColor: theme.accentSoft, borderColor: theme.tint }]}>
						<ThemedText style={[styles.connectionsCount, { color: theme.tint }]}>
							{recommendations.isPending ? "–" : newConnections}
						</ThemedText>
					</View>
					<View style={styles.connectionsText}>
						<ThemedText type="subtitle">{t("home.newConnections")}</ThemedText>
						<ThemedText type="caption" style={{ color: theme.muted }}>
							{newConnections > 0 ? t("home.connectionsHint") : t("home.connectionsEmptyHint")}
						</ThemedText>
					</View>
					<View style={styles.connectionsActions}>
						{/* Nested pressable: takes the touch, so the card's own navigation doesn't fire. */}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("filters.buttonA11y", { summary: filtersSummary ?? t("filters.everyone") })}
							hitSlop={Spacing.sm}
							onPress={() => router.push("/filters" as Href)}
							style={({ pressed }) => [
								styles.filtersButton,
								{ backgroundColor: filtersSummary ? theme.accentSoft : theme.field, opacity: pressed ? 0.6 : 1 },
							]}
						>
							<Ionicons name="options-outline" size={18} color={filtersSummary ? theme.tint : theme.muted} />
						</Pressable>
						<Ionicons name="chevron-forward" size={22} color={theme.muted} />
					</View>
				</Pressable>

				<MoodCard />

				<DailyQuestionCard />
			</ScrollView>

			<BottomDock
				width={width}
				bottomInset={insets.bottom}
				fill={dock.fill}
				border={dock.border}
				shadow={dock.shadow}
				unreadCount={unreadMessages}
				fabColor={theme.tint}
				fabForeground={theme.onTint}
				badgeBackground={theme.background}
				badgeForeground={theme.tint}
				onMessagesPress={() => router.push("/matches" as Href)}
			/>
			<NewMatchDialog matches={matches.data?.matches} />
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
	},
	headerSide: {
		width: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	headerCenter: {
		flex: 1,
		minWidth: 0,
		alignItems: "center",
		paddingHorizontal: Spacing.xs,
	},
	headerPillPressable: {
		maxWidth: "100%",
	},
	iconButton: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	greeting: {
		marginTop: Spacing.sm,
		gap: Spacing.xs,
	},
	date: {
		textTransform: "uppercase",
		letterSpacing: 1,
	},
	connectionsActions: {
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "space-between",
	},
	filtersButton: {
		width: 34,
		height: 34,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	connectionsCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.lg,
		padding: Spacing.lg,
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
	},
	connectionsCircle: {
		width: 76,
		height: 76,
		borderRadius: Radius.pill,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	connectionsCount: {
		fontSize: 32,
		lineHeight: 38,
		fontWeight: "600",
		fontFamily: FontFamily.body,
	},
	connectionsText: {
		flex: 1,
		minWidth: 0,
		gap: Spacing.xs,
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

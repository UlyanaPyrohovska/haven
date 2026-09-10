import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConnectionDock, connectionDockClearance } from "@/components/connections/connection-dock";
import { type DecisionKind, DecisionOverlay, useDecisionCardStyle } from "@/components/connections/decision-animation";
import { ProfileBadges } from "@/components/connections/profile-badges";
import { ProfileHeaderButton } from "@/components/profile/profile-header-button";
import { ThemedText } from "@/components/themed-text";
import { BackHomeButton } from "@/components/ui/back-home-button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FontSize, Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import {
	fetchRecommendation,
	fetchRecommendations,
	postRecommendationDecision,
	recommendationQueryKey,
	recommendationsQueryKey,
} from "@/lib/api/recommendations";

function InterestTag({ label, inverted = false }: { label: string; inverted?: boolean }) {
	const theme = useTheme();

	return (
		<View
			style={[
				styles.tag,
				{
					backgroundColor: inverted ? theme.text : theme.accentSoft,
					borderColor: inverted ? theme.text : theme.tint,
				},
			]}
		>
			<ThemedText type="caption" style={{ color: inverted ? theme.background : theme.tint }}>
				{label}
			</ThemedText>
		</View>
	);
}

type ConnectionCandidateScreenProps = {
	candidateId: number;
	/** Called after the decision animation (or match dialog) when browsing should advance. */
	onAdvance: (remainingCount: number) => Promise<void>;
};

export function ConnectionCandidateScreen({ candidateId, onAdvance }: ConnectionCandidateScreenProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const queryClient = useQueryClient();
	const [decisionKind, setDecisionKind] = useState<DecisionKind | null>(null);
	const [matchedDialog, setMatchedDialog] = useState(false);
	const [messageDialog, setMessageDialog] = useState(false);
	const [matchedName, setMatchedName] = useState("");
	const [pendingMatch, setPendingMatch] = useState(false);

	const cardStyle = useDecisionCardStyle(decisionKind);

	const connection = useQuery({
		queryKey: recommendationQueryKey(candidateId),
		queryFn: () => fetchRecommendation(candidateId),
		enabled: Number.isFinite(candidateId),
	});

	const decide = useMutation({
		mutationFn: (decision: DecisionKind) => postRecommendationDecision(candidateId, decision),
	});

	const locationLabel = connection.data?.locationLabel ?? t("home.locationFallback");

	const prefetchNextCandidate = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: recommendationsQueryKey });
		const refreshed = await queryClient.fetchQuery({
			queryKey: recommendationsQueryKey,
			queryFn: fetchRecommendations,
		});

		const next = refreshed.recommendations[0];

		if (next) {
			await queryClient.prefetchQuery({
				queryKey: recommendationQueryKey(next.candidateId),
				queryFn: () => fetchRecommendation(next.candidateId),
			});
		}

		return next ?? null;
	}, [queryClient]);

	const finishAdvance = useCallback(async () => {
		await onAdvance(decide.data?.remainingCount ?? 0);
		setDecisionKind(null);
	}, [decide.data?.remainingCount, onAdvance]);

	const onAnimationFinished = useCallback(() => {
		if (pendingMatch) {
			setMatchedDialog(true);
			setPendingMatch(false);
			setDecisionKind(null);
			return;
		}

		void finishAdvance();
	}, [finishAdvance, pendingMatch]);

	const onDecision = (kind: DecisionKind) => {
		if (decisionKind || decide.isPending || !connection.data) {
			return;
		}

		setDecisionKind(kind);
		decide.mutate(kind, {
			onSuccess: async (result) => {
				await prefetchNextCandidate();

				if (kind === "accept" && result.matched) {
					setMatchedName(connection.data.displayName);
					setPendingMatch(true);
				}
			},
		});
	};

	if (connection.isPending || !Number.isFinite(candidateId)) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background }]}>
				<ActivityIndicator color={theme.tint} />
			</View>
		);
	}

	if (connection.isError || !connection.data) {
		return (
			<View style={[styles.centered, { backgroundColor: theme.background, padding: Spacing.xl }]}>
				<ErrorBanner message={t("auth.errors.network")} />
				<ThemedText type="link" onPress={() => connection.refetch()}>
					{t("common.retry")}
				</ThemedText>
			</View>
		);
	}

	const data = connection.data;
	const photoInterests = data.interests.slice(0, 3);

	return (
		<View style={[styles.root, { backgroundColor: theme.background }]}>
			<ScrollView
				contentContainerStyle={[
					styles.scroll,
					{
						paddingTop: insets.top + Spacing.md,
						paddingBottom: insets.bottom + connectionDockClearance,
					},
				]}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.header}>
					<BackHomeButton accessibilityLabel={t("common.back")} />

					<View style={[styles.locationPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
						<Ionicons name="location-outline" size={14} color={theme.icon} />
						<ThemedText type="caption" style={styles.locationText}>
							{locationLabel}
						</ThemedText>
					</View>

					<ProfileHeaderButton size={40} />
				</View>

				<ThemedText type="label" style={styles.sectionTitle}>
					{t("connections.title")}
				</ThemedText>

				<Animated.View style={cardStyle}>
					<View style={[styles.photoCard, { backgroundColor: theme.field, borderColor: theme.border }]}>
						<Image source={{ uri: data.photoUrl }} style={styles.photoImage} contentFit="cover" />
						<View style={styles.photoScrim} />

						<View style={styles.photoOverlay}>
							<ThemedText type="title" style={styles.photoOverlayText}>
								{data.displayName}
							</ThemedText>
							{data.ageLabel ? <ThemedText style={styles.photoOverlaySubtext}>{data.ageLabel}</ThemedText> : null}
							<ProfileBadges mood={data.mood} isSynthetic={data.isSynthetic} inverted />
							<View style={styles.tagRow}>
								{photoInterests.map((interest) => (
									<InterestTag key={interest} label={interest} inverted />
								))}
							</View>
						</View>
					</View>

					<View style={styles.block}>
						<ThemedText type="label">{t("home.todaysQuestion")}</ThemedText>
						<ThemedText style={[styles.quote, { color: theme.muted }]}>{`"${data.dailyQuestion}"`}</ThemedText>
						<View style={[styles.answerBubble, { backgroundColor: theme.surface, borderColor: theme.border }]}>
							<ThemedText style={{ lineHeight: 22 }}>{data.questionAnswer}</ThemedText>
						</View>
					</View>

					<View style={styles.block}>
						<ThemedText type="label">{t("connections.whyMatched")}</ThemedText>
						<View style={styles.tagRow}>
							{data.sharedInterests.map((interest) => (
								<InterestTag key={interest} label={interest} />
							))}
						</View>
					</View>

					<ThemedText style={[styles.crossPaths, { color: theme.muted }]}>
						{t("connections.crossPaths", { count: data.crossPathsCount })}
					</ThemedText>
				</Animated.View>
			</ScrollView>

			<ConnectionDock
				bottomInset={insets.bottom}
				disabled={data.actedOn || decisionKind !== null || decide.isPending}
				onAccept={() => onDecision("accept")}
				onDecline={() => onDecision("decline")}
				onMessage={() => setMessageDialog(true)}
			/>

			<DecisionOverlay kind={decisionKind} onFinished={onAnimationFinished} />

			<Dialog
				visible={matchedDialog}
				icon="heart-outline"
				tone="default"
				title={t("connections.matchedTitle")}
				message={t("connections.matchedMessage", { name: matchedName })}
				confirmLabel={t("connections.continueBrowsing")}
				onConfirm={() => {
					setMatchedDialog(false);
					void finishAdvance();
				}}
			/>

			<Dialog
				visible={messageDialog}
				icon="chatbubble-ellipses-outline"
				title={t("connections.message")}
				message={t("connections.messageSoon")}
				confirmLabel={t("common.continue")}
				onConfirm={() => setMessageDialog(false)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.md,
	},
	scroll: {
		paddingHorizontal: Spacing.xl,
		gap: Spacing.lg,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	locationPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		maxWidth: "58%",
	},
	locationText: {
		fontWeight: "500",
	},
	sectionTitle: {
		marginTop: Spacing.sm,
	},
	photoCard: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	photoImage: {
		height: 320,
		width: "100%",
	},
	photoScrim: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: 160,
		backgroundColor: "rgba(0, 0, 0, 0.42)",
	},
	photoOverlay: {
		position: "absolute",
		left: Spacing.lg,
		right: Spacing.lg,
		bottom: Spacing.lg,
		gap: Spacing.xs,
	},
	photoOverlayText: {
		color: "#ffffff",
	},
	photoOverlaySubtext: {
		color: "#ffffff",
		opacity: 0.92,
	},
	tagRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
		marginTop: Spacing.sm,
	},
	tag: {
		borderRadius: Radius.pill,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
	},
	block: {
		gap: Spacing.sm,
		marginTop: Spacing.lg,
	},
	quote: {
		fontSize: FontSize.md,
		lineHeight: 24,
		fontStyle: "italic",
	},
	answerBubble: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
	},
	crossPaths: {
		marginTop: Spacing.lg,
		textAlign: "center",
		fontSize: FontSize.md,
	},
});

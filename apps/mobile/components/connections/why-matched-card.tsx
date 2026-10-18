import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { InterestChip, InterestChipRow } from "@/components/ui/interest-chip";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import type { MatchDetail, MatchReason } from "@/lib/api/recommendations";
import { interestWithEmoji } from "@/lib/profile/display";

const REASON_ICONS: Record<MatchReason, ComponentProps<typeof Ionicons>["name"]> = {
	sharedInterests: "sparkles-outline",
	theirType: "heart-outline",
	yourType: "star-outline",
	nearby: "location-outline",
	crossedPaths: "footsteps-outline",
	compatible: "people-outline",
};

type WhyMatchedCardProps = {
	match: MatchDetail;
	name: string;
	sharedInterests: string[];
};

/** Explains a mutual match from the same score components the recommender used. */
export function WhyMatchedCard({ match, name, sharedInterests }: WhyMatchedCardProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const matchedOn = new Date(match.matchedAt).toLocaleDateString([], { day: "numeric", month: "long" });

	return (
		<View style={[styles.card, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
			<View style={styles.header}>
				<View style={styles.headerCopy}>
					<ThemedText type="label">{t("connections.whyMatched")}</ThemedText>
					<ThemedText type="caption" style={{ color: theme.muted }}>
						{t("connections.matchedOn", { date: matchedOn })}
					</ThemedText>
				</View>
				<View style={[styles.score, { backgroundColor: theme.tint }]}>
					<ThemedText type="bodySemiBold" style={{ color: theme.onTint }}>
						{t("connections.compatibility", { percent: Math.round(match.compatibility * 100) })}
					</ThemedText>
				</View>
			</View>

			{match.reasons.map((reason) => (
				<View key={reason} style={styles.reason}>
					<Ionicons name={REASON_ICONS[reason]} size={18} color={theme.tint} />
					<ThemedText style={styles.reasonText}>{t(`connections.matchReasons.${reason}`, { name })}</ThemedText>
				</View>
			))}

			{match.reasons.includes("sharedInterests") && sharedInterests.length > 0 ? (
				<InterestChipRow>
					{sharedInterests.map((interest) => (
						<InterestChip key={interest} label={interestWithEmoji(interest)} highlighted />
					))}
				</InterestChipRow>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
	},
	headerCopy: {
		flex: 1,
		gap: 2,
	},
	score: {
		borderRadius: Radius.pill,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
	},
	reason: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	reasonText: {
		flex: 1,
		lineHeight: 22,
	},
});

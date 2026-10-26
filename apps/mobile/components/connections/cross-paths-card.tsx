import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";

const MAP_W = 320;
const MAP_H = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

type CrossPathsCardProps = {
	count: number;
	place: string | null;
	lastCrossedAt: string | null;
};

/** Stable 0..1 values from the place label, so each place gets its own street layout. */
function placeSeed(place: string | null): [number, number, number] {
	let hash = 2166136261;

	for (const char of place ?? "") {
		hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
	}

	return [(hash & 0xff) / 255, ((hash >>> 8) & 0xff) / 255, ((hash >>> 16) & 0xff) / 255];
}

function daysAgo(iso: string | null): number | null {
	if (!iso) {
		return null;
	}

	const time = Date.parse(iso);

	return Number.isNaN(time) ? null : Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
}

/**
 * Illustrated (not geographic) map of where two people crossed paths. Only the area
 * label is real; nothing here is derived from either person's coordinates.
 */
function IllustratedMap({ place }: { place: string | null }) {
	const theme = useTheme();
	const [a, b, c] = placeSeed(place);
	const pinX = 120 + a * 80;
	const pinY = 60 + b * 30;
	const roadX = [70 + c * 20, pinX, 250 - a * 20];
	const roadY = [pinY, 120 - b * 10];
	const diagonalShift = (c - 0.5) * 60;

	return (
		<Svg width="100%" height="100%" viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
			<Rect x={0} y={0} width={MAP_W} height={MAP_H} fill={theme.field} />

			{/* Park */}
			<Rect x={roadX[2] + 10} y={8} width={70} height={pinY - 18} rx={14} fill={theme.accentSoft} />

			{/* Streets */}
			{roadX.map((x) => (
				<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={MAP_H} stroke={theme.background} strokeWidth={10} />
			))}
			{roadY.map((y) => (
				<Line key={`h${y}`} x1={0} y1={y} x2={MAP_W} y2={y} stroke={theme.background} strokeWidth={10} />
			))}
			<Line
				x1={20 + diagonalShift}
				y1={MAP_H}
				x2={200 + diagonalShift}
				y2={0}
				stroke={theme.background}
				strokeWidth={14}
			/>

			{/* Two walks meeting at the pin */}
			<Path
				d={`M 8 ${MAP_H - 10} Q ${pinX - 60} ${pinY + 50} ${pinX} ${pinY}`}
				stroke={theme.tint}
				strokeWidth={3}
				strokeDasharray="2 7"
				strokeLinecap="round"
				fill="none"
			/>
			<Path
				d={`M ${MAP_W - 8} 10 Q ${pinX + 70} ${pinY - 40} ${pinX} ${pinY}`}
				stroke={theme.muted}
				strokeWidth={3}
				strokeDasharray="2 7"
				strokeLinecap="round"
				fill="none"
			/>

			{/* Approximate-area halo, not a precise point */}
			<Circle cx={pinX} cy={pinY} r={26} fill={theme.tint} opacity={0.16} />
			<Circle cx={pinX} cy={pinY} r={7} fill={theme.tint} stroke={theme.background} strokeWidth={3} />
		</Svg>
	);
}

export function CrossPathsCard({ count, place, lastCrossedAt }: CrossPathsCardProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const days = daysAgo(lastCrossedAt);
	const when =
		days == null
			? null
			: days === 0
				? t("connections.crossPathsCard.today")
				: days === 1
					? t("connections.crossPathsCard.yesterday")
					: t("connections.crossPathsCard.daysAgo", { count: days });
	const where = place ? t("connections.crossPathsCard.lastNear", { place }) : null;
	const detail = [where, when].filter(Boolean).join(" · ");

	return (
		<View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
			<View
				style={styles.map}
				accessible
				accessibilityRole="image"
				accessibilityLabel={t("connections.crossPathsCard.mapLabel", { place: place ?? "" })}
			>
				<IllustratedMap place={place} />
			</View>

			<View style={styles.body}>
				<View style={styles.titleRow}>
					<Ionicons name="footsteps-outline" size={18} color={theme.tint} />
					<ThemedText type="label" style={styles.title}>
						{t("connections.crossPaths", { count })}
					</ThemedText>
				</View>
				{detail ? <ThemedText style={{ color: theme.text }}>{detail}</ThemedText> : null}
				<ThemedText type="caption" style={{ color: theme.muted }}>
					{t("connections.crossPathsCard.privacyNote")}
				</ThemedText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		borderRadius: Radius.lg,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: "hidden",
	},
	map: {
		height: 140,
		width: "100%",
	},
	body: {
		padding: Spacing.lg,
		gap: Spacing.xs,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	title: {
		flex: 1,
	},
});

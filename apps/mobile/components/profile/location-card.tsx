import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ChipGroup } from "@/components/ui/chip-group";
import { MenuCard } from "@/components/ui/menu-row";
import { Radius, Spacing } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { LOCATION_PRESETS, type LocationPresetId } from "@/lib/profile/location";

type LocationCardProps = {
	preset: LocationPresetId | undefined;
	displayLocation: string | null;
	busy: boolean;
	onPresetChange: (preset: LocationPresetId) => void;
	onRefresh: () => void;
};

/** Current-location vs hidden picker with a status row; shared by onboarding and settings. */
export function LocationCard({ preset, displayLocation, busy, onPresetChange, onRefresh }: LocationCardProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const options = LOCATION_PRESETS.map((item) => ({ value: item.id, label: t(item.labelKey), emoji: item.emoji }));
	const hidden = preset === "hidden" && !busy;
	const statusLabel = busy
		? t("profile.locationScreen.locating")
		: hidden
			? t("profile.locationScreen.hiddenLabel")
			: (displayLocation ?? t("profile.locationScreen.deviceLabel"));

	return (
		<MenuCard>
			<View style={styles.section}>
				<ThemedText type="label">{t("profile.locationScreen.displayTitle")}</ThemedText>
				<ThemedText type="caption" style={{ color: theme.muted }}>
					{t("profile.locationScreen.displayHint")}
				</ThemedText>
				<ChipGroup<LocationPresetId>
					label={t("profile.locationScreen.displayTitle")}
					hideLabel
					options={options}
					value={busy ? "device" : preset}
					onChange={onPresetChange}
				/>
				{busy || preset ? (
					<View style={[styles.status, { backgroundColor: theme.field }]}>
						<View style={[styles.statusIcon, { backgroundColor: hidden ? theme.border : theme.tint }]}>
							<Ionicons
								name={hidden ? "eye-off-outline" : "location"}
								size={16}
								color={hidden ? theme.muted : theme.onTint}
							/>
						</View>
						<ThemedText
							type="label"
							numberOfLines={1}
							style={[styles.statusLabel, hidden ? { color: theme.muted } : null]}
						>
							{statusLabel}
						</ThemedText>
						{busy ? (
							<ActivityIndicator size="small" color={theme.tint} />
						) : hidden ? null : (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t("profile.locationScreen.useDevice")}
								hitSlop={Spacing.sm}
								onPress={onRefresh}
								style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
							>
								<Ionicons name="refresh" size={20} color={theme.tint} />
							</Pressable>
						)}
					</View>
				) : null}
			</View>
		</MenuCard>
	);
}

const styles = StyleSheet.create({
	section: {
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	status: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.md,
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm + 2,
		borderRadius: Radius.md,
	},
	statusIcon: {
		width: 28,
		height: 28,
		borderRadius: Radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},
	statusLabel: {
		flex: 1,
	},
});

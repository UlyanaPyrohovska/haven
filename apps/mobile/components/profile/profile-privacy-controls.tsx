import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { MenuCard, MenuDivider } from "@/components/ui/menu-row";
import { SettingToggleRow } from "@/components/ui/setting-toggle-row";
import { Spacing } from "@/constants/app-config";
import type { PrivacyKey, PrivacySettings } from "@/lib/profile/privacy";

type ProfilePrivacyControlsProps = {
	privacy: PrivacySettings;
	onToggle: (key: PrivacyKey, value: boolean) => void;
	disabled?: boolean;
	busy?: boolean;
	/** Onboarding hides the discoverability card; new profiles start discoverable. */
	showVisibility?: boolean;
};

export function ProfilePrivacyControls({
	privacy,
	onToggle,
	disabled = false,
	busy = false,
	showVisibility = true,
}: ProfilePrivacyControlsProps) {
	const { t } = useTranslation();

	return (
		<>
			{showVisibility ? (
				<MenuCard>
					<View style={styles.sectionHeader}>
						<ThemedText type="label">{t("profile.settingsScreen.visibility.title")}</ThemedText>
						{busy ? <ActivityIndicator size="small" /> : null}
					</View>
					<SettingToggleRow
						label={t("profile.settingsScreen.visibility.discoverable")}
						subtitle={t("profile.settingsScreen.visibility.discoverableHint")}
						value={privacy.discoverable}
						onValueChange={(value) => onToggle("discoverable", value)}
						disabled={disabled}
					/>
				</MenuCard>
			) : null}

			<MenuCard>
				<View style={styles.sectionHeader}>
					<ThemedText type="label">{t("profile.settingsScreen.privacy.title")}</ThemedText>
				</View>
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showAge")}
					value={privacy.showAge}
					onValueChange={(value) => onToggle("showAge", value)}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showCareer")}
					value={privacy.showCareer}
					onValueChange={(value) => onToggle("showCareer", value)}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showBio")}
					value={privacy.showBio}
					onValueChange={(value) => onToggle("showBio", value)}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showInterests")}
					value={privacy.showInterests}
					onValueChange={(value) => onToggle("showInterests", value)}
					disabled={disabled}
				/>
			</MenuCard>
		</>
	);
}

const styles = StyleSheet.create({
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.xs,
	},
});

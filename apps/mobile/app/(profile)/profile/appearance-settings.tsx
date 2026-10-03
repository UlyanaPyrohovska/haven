import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ChipGroup } from "@/components/ui/chip-group";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard } from "@/components/ui/menu-row";
import { Spacing } from "@/constants/app-config";
import { ThemePreference, type ThemePreferenceValue, useThemePreference } from "@/lib/theme/preference";

export default function AppearanceSettingsScreen() {
	const { t } = useTranslation();
	const { preference, setPreference } = useThemePreference();

	const appearanceOptions = useMemo(
		() => [
			{ value: ThemePreference.system, label: t("profile.settingsScreen.appearance.system") },
			{ value: ThemePreference.light, label: t("profile.settingsScreen.appearance.light") },
			{ value: ThemePreference.dark, label: t("profile.settingsScreen.appearance.dark") },
		],
		[t],
	);

	return (
		<FormScreen
			title={t("profile.settingsScreen.appearanceScreen.title")}
			subtitle={t("profile.settingsScreen.appearanceScreen.subtitle")}
			showBack
		>
			<MenuCard>
				<View style={styles.appearance}>
					<View style={styles.appearanceCopy}>
						<ThemedText type="label">{t("profile.settingsScreen.appearance.title")}</ThemedText>
						<ThemedText type="caption">{t("profile.settingsScreen.appearance.subtitle")}</ThemedText>
					</View>
					<ChipGroup<ThemePreferenceValue>
						hideLabel
						label={t("profile.settingsScreen.appearance.title")}
						options={appearanceOptions}
						value={preference}
						onChange={setPreference}
					/>
				</View>
			</MenuCard>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	appearance: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.lg,
		gap: Spacing.md,
	},
	appearanceCopy: {
		gap: Spacing.xs,
	},
});

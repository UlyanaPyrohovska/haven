import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ChipGroup } from "@/components/ui/chip-group";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { Spacing } from "@/constants/app-config";
import { signOut } from "@/lib/auth/client";
import { ThemePreference, type ThemePreferenceValue, useThemePreference } from "@/lib/theme/preference";

export default function ProfileSettingsScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { preference, setPreference } = useThemePreference();

	const appearanceOptions = useMemo(
		() => [
			{ value: ThemePreference.system, label: t("profile.settingsScreen.appearance.system") },
			{ value: ThemePreference.light, label: t("profile.settingsScreen.appearance.light") },
			{ value: ThemePreference.dark, label: t("profile.settingsScreen.appearance.dark") },
		],
		[t],
	);

	const onSignOut = async () => {
		await signOut();
		queryClient.clear();
		router.replace("/login");
	};

	return (
		<FormScreen title={t("profile.settingsScreen.title")} subtitle={t("profile.settingsScreen.subtitle")} showBack>
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

			<MenuCard>
				<MenuRow
					label={t("profile.settingsScreen.privacy.title")}
					subtitle={`${t("profile.settingsScreen.privacy.subtitle")} · ${t("profile.settingsScreen.comingSoon")}`}
				/>
				<MenuDivider />
				<MenuRow
					label={t("profile.settingsScreen.visibility.title")}
					subtitle={`${t("profile.settingsScreen.visibility.subtitle")} · ${t("profile.settingsScreen.comingSoon")}`}
				/>
				<MenuDivider />
				<MenuRow
					label={t("profile.settingsScreen.location.title")}
					subtitle={`${t("profile.settingsScreen.location.subtitle")} · ${t("profile.settingsScreen.comingSoon")}`}
				/>
			</MenuCard>

			<MenuCard>
				<MenuRow label={t("common.signOut")} onPress={onSignOut} destructive />
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

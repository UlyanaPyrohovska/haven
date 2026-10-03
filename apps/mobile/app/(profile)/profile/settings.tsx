import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { useProfileQuery } from "@/hooks/use-profile";
import { signOut } from "@/lib/auth/client";
import { locationSettingsSummary } from "@/lib/profile/location";
import { readPrivacySettings } from "@/lib/profile/privacy";
import { ThemePreference, useThemePreference } from "@/lib/theme/preference";

export default function ProfileSettingsScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { preference } = useThemePreference();
	const profile = useProfileQuery(true);

	const privacy = readPrivacySettings(profile.data);

	const locationSummary = locationSettingsSummary(
		profile.data,
		t("home.locationUnset"),
		t("home.noLocation"),
	);

	const visibilitySummary = privacy.discoverable
		? t("profile.settingsScreen.visibility.summaryActive")
		: t("profile.settingsScreen.visibility.summaryPaused");

	const appearanceSummary = useMemo(() => {
		switch (preference) {
			case ThemePreference.light:
				return t("profile.settingsScreen.appearance.light");
			case ThemePreference.dark:
				return t("profile.settingsScreen.appearance.dark");
			default:
				return t("profile.settingsScreen.appearance.system");
		}
	}, [preference, t]);

	const onSignOut = async () => {
		await signOut();
		queryClient.clear();
		router.replace("/login");
	};

	return (
		<FormScreen title={t("profile.settingsScreen.title")} subtitle={t("profile.settingsScreen.subtitle")} showBack>
			<MenuCard>
				<MenuRow
					label={t("profile.settingsScreen.location.title")}
					subtitle={locationSummary}
					onPress={() => router.push("/profile/location-settings")}
				/>
				<MenuDivider />
				<MenuRow
					label={t("profile.settingsScreen.visibility.menuTitle")}
					subtitle={visibilitySummary}
					onPress={() => router.push("/profile/visibility-settings")}
				/>
				<MenuDivider />
				<MenuRow
					label={t("profile.settingsScreen.appearance.menuTitle")}
					subtitle={appearanceSummary}
					onPress={() => router.push("/profile/appearance-settings")}
				/>
			</MenuCard>

			<MenuCard>
				<MenuRow label={t("common.signOut")} onPress={onSignOut} destructive />
			</MenuCard>
		</FormScreen>
	);
}

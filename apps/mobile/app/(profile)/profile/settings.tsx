import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Dialog } from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider, MenuRow } from "@/components/ui/menu-row";
import { useProfileQuery } from "@/hooks/use-profile";
import { deleteAccount } from "@/lib/api/profile";
import { signOut } from "@/lib/auth/client";
import { resetToLogin } from "@/lib/auth/navigation";
import { API_URL } from "@/lib/config/env";
import { stopNotifications } from "@/lib/notifications";
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

	const locationSummary = locationSettingsSummary(profile.data, t("home.locationUnset"), t("home.noLocation"));

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

	const [confirmDelete, setConfirmDelete] = useState(false);

	const onSignOut = async () => {
		await stopNotifications();
		await signOut();
		queryClient.clear();
		resetToLogin(router);
	};

	const removeAccount = useMutation({
		mutationFn: deleteAccount,
		onSuccess: async () => {
			setConfirmDelete(false);
			// Server tokens went with the profile; this clears the scheduled reminder.
			await stopNotifications();
			// The server already dropped the session; this clears the local cookie.
			await signOut().catch(() => {});
			queryClient.clear();
			resetToLogin(router);
		},
	});

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
				<MenuRow
					label={t("profile.settingsScreen.privacyPolicy")}
					onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}
				/>
				<MenuDivider />
				<MenuRow
					label={t("profile.settingsScreen.support")}
					onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/support`)}
				/>
			</MenuCard>

			<MenuCard>
				<MenuRow label={t("common.signOut")} onPress={onSignOut} destructive />
				<MenuDivider />
				<MenuRow
					label={t("profile.settingsScreen.deleteAccount.menuTitle")}
					onPress={() => setConfirmDelete(true)}
					destructive
				/>
			</MenuCard>

			<Dialog
				visible={confirmDelete}
				icon="trash-outline"
				tone="danger"
				title={t("profile.settingsScreen.deleteAccount.title")}
				message={t("profile.settingsScreen.deleteAccount.message")}
				confirmLabel={t("profile.settingsScreen.deleteAccount.confirm")}
				onConfirm={() => removeAccount.mutate()}
				cancelLabel={t("common.cancel")}
				onCancel={() => setConfirmDelete(false)}
				loading={removeAccount.isPending}
				dismissable={!removeAccount.isPending}
			>
				{removeAccount.isError ? <ErrorBanner message={t("profile.settingsScreen.deleteAccount.error")} /> : null}
			</Dialog>
		</FormScreen>
	);
}

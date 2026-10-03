import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider } from "@/components/ui/menu-row";
import { SettingToggleRow } from "@/components/ui/setting-toggle-row";
import { Spacing } from "@/constants/app-config";
import { profileQueryKey, useProfileQuery } from "@/hooks/use-profile";
import { saveProfileSettings } from "@/lib/api/profile";
import { type PrivacyKey, readPrivacySettings } from "@/lib/profile/privacy";

export default function VisibilitySettingsScreen() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const profile = useProfileQuery(true);
	const [saveError, setSaveError] = useState<string | null>(null);

	const privacy = readPrivacySettings(profile.data);

	const saveMutation = useMutation({
		mutationFn: saveProfileSettings,
		onMutate: async (updates) => {
			setSaveError(null);
			await queryClient.cancelQueries({ queryKey: profileQueryKey });
			const previous = queryClient.getQueryData(profileQueryKey);
			queryClient.setQueryData(profileQueryKey, (current) =>
				current && typeof current === "object" ? { ...current, ...updates } : current,
			);

			return { previous };
		},
		onSuccess: (updatedProfile) => {
			queryClient.setQueryData(profileQueryKey, updatedProfile);
		},
		onError: (_error, _updates, context) => {
			if (context?.previous !== undefined) {
				queryClient.setQueryData(profileQueryKey, context.previous);
			}

			setSaveError(t("profile.settingsScreen.saveError"));
		},
	});

	const onTogglePrivacy = (key: PrivacyKey, value: boolean) => {
		saveMutation.mutate({ [key]: value });
	};

	const busy = saveMutation.isPending || profile.isPending;
	const disabled = busy || !profile.data;

	return (
		<FormScreen
			title={t("profile.settingsScreen.visibilityScreen.title")}
			subtitle={t("profile.settingsScreen.visibilityScreen.subtitle")}
			showBack
		>
			{saveError ? <ErrorBanner message={saveError} /> : null}

			<MenuCard>
				<View style={styles.sectionHeader}>
					<ThemedText type="label">{t("profile.settingsScreen.visibility.title")}</ThemedText>
					{busy ? <ActivityIndicator size="small" /> : null}
				</View>
				<SettingToggleRow
					label={t("profile.settingsScreen.visibility.discoverable")}
					subtitle={t("profile.settingsScreen.visibility.discoverableHint")}
					value={privacy.discoverable}
					onValueChange={(value) => onTogglePrivacy("discoverable", value)}
					disabled={disabled}
				/>
			</MenuCard>

			<MenuCard>
				<View style={styles.sectionHeader}>
					<ThemedText type="label">{t("profile.settingsScreen.privacy.title")}</ThemedText>
				</View>
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showAge")}
					value={privacy.showAge}
					onValueChange={(value) => onTogglePrivacy("showAge", value)}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showCareer")}
					value={privacy.showCareer}
					onValueChange={(value) => onTogglePrivacy("showCareer", value)}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showBio")}
					value={privacy.showBio}
					onValueChange={(value) => onTogglePrivacy("showBio", value)}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.settingsScreen.privacy.showInterests")}
					value={privacy.showInterests}
					onValueChange={(value) => onTogglePrivacy("showInterests", value)}
					disabled={disabled}
				/>
			</MenuCard>
		</FormScreen>
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet } from "react-native";

import { LocationCard } from "@/components/profile/location-card";
import { ThemedText } from "@/components/themed-text";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider } from "@/components/ui/menu-row";
import { SettingToggleRow } from "@/components/ui/setting-toggle-row";
import { Spacing } from "@/constants/app-config";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { mergeProfileCache, profileQueryKey, refreshProfileCache, useProfileQuery } from "@/hooks/use-profile";
import { saveProfileSettings } from "@/lib/api/profile";
import {
	buildHiddenLocationPayload,
	type LocationPresetId,
	readLocationSettings,
	resolveLocationPreset,
} from "@/lib/profile/location";

export default function LocationSettingsScreen() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const profile = useProfileQuery(true);
	const device = useDeviceLocation();
	const [saveError, setSaveError] = useState<string | null>(null);

	const settings = readLocationSettings(profile.data);
	const disabled = !profile.data;

	// Optimistic: the cache (and so the preset/toggles) updates instantly and rolls back on failure.
	const saveMutation = useMutation({
		mutationFn: saveProfileSettings,
		onMutate: async (updates) => {
			setSaveError(null);
			await queryClient.cancelQueries({ queryKey: profileQueryKey });
			const previous = queryClient.getQueryData(profileQueryKey);
			mergeProfileCache(queryClient, updates);

			return { previous };
		},
		onSuccess: (updatedProfile, updates) => {
			mergeProfileCache(queryClient, updates, updatedProfile);
		},
		onError: (_error, _updates, context) => {
			if (context?.previous !== undefined) {
				queryClient.setQueryData(profileQueryKey, context.previous);
			}

			setSaveError(t("profile.locationScreen.saveError"));
		},
		onSettled: () => refreshProfileCache(queryClient),
	});

	const onUseDeviceLocation = async () => {
		setSaveError(null);
		const location = await device.read();

		if (location) {
			saveMutation.mutate({
				locationHidden: false,
				displayLocation: location.label,
				latitude: location.latitude,
				longitude: location.longitude,
			});
		}
	};

	const onPresetChange = (preset: LocationPresetId) => {
		if (preset === "device") {
			void onUseDeviceLocation();
			return;
		}

		device.setError(undefined);
		saveMutation.mutate(buildHiddenLocationPayload());
	};

	return (
		<FormScreen title={t("profile.locationScreen.title")} subtitle={t("profile.locationScreen.subtitle")} showBack>
			<ErrorBanner message={device.error ?? saveError ?? undefined} />

			{profile.data ? (
				<LocationCard
					preset={resolveLocationPreset(profile.data)}
					displayLocation={settings.displayLocation}
					busy={device.busy}
					onPresetChange={onPresetChange}
					onRefresh={() => void onUseDeviceLocation()}
				/>
			) : (
				<ActivityIndicator style={styles.loader} />
			)}

			<MenuCard>
				<SettingToggleRow
					label={t("profile.locationScreen.shareProximity")}
					subtitle={t("profile.locationScreen.shareProximityHint")}
					value={settings.shareLocation}
					onValueChange={(value) => saveMutation.mutate({ shareLocation: value })}
					disabled={disabled}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.locationScreen.shareCrossPaths")}
					subtitle={t("profile.locationScreen.shareCrossPathsHint")}
					value={settings.shareCrossPaths}
					onValueChange={(value) => saveMutation.mutate({ shareCrossPaths: value })}
					disabled={disabled}
				/>
			</MenuCard>

			<ThemedText type="caption" style={styles.footerHint}>
				{t("profile.locationScreen.footerHint")}
			</ThemedText>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	loader: {
		paddingVertical: Spacing.xl,
	},
	footerHint: {
		paddingHorizontal: Spacing.sm,
		opacity: 0.85,
		lineHeight: 20,
	},
});

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard } from "@/components/ui/menu-row";
import { SettingToggleRow } from "@/components/ui/setting-toggle-row";
import { Spacing } from "@/constants/app-config";
import { mergeProfileCache, profileQueryKey, refreshProfileCache, useProfileQuery } from "@/hooks/use-profile";
import { saveProfileSettings } from "@/lib/api/profile";
import { DeviceLocationError, readDeviceLocation } from "@/lib/profile/device-location";
import {
	buildHiddenLocationPayload,
	LOCATION_PRESETS,
	type LocationPresetId,
	readLocationSettings,
	resolveLocationPreset,
} from "@/lib/profile/location";

const SAVE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) => {
			setTimeout(() => reject(new Error(message)), timeoutMs);
		}),
	]);
}

export default function LocationSettingsScreen() {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const profile = useProfileQuery(true);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [presetId, setPresetId] = useState<LocationPresetId | undefined>(undefined);
	const [deviceBusy, setDeviceBusy] = useState(false);

	const settings = readLocationSettings(profile.data);

	useEffect(() => {
		if (!profile.data) {
			return;
		}

		setPresetId(resolveLocationPreset(profile.data));
	}, [profile.data]);

	const presetOptions = useMemo(
		() =>
			LOCATION_PRESETS.map((preset) => ({
				value: preset.id,
				label: t(preset.labelKey),
			})),
		[t],
	);

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
		onSuccess: (updatedProfile, updates) => {
			mergeProfileCache(queryClient, updates, updatedProfile);
			void refreshProfileCache(queryClient);
		},
		onError: (_error, _updates, context) => {
			if (context?.previous !== undefined) {
				queryClient.setQueryData(profileQueryKey, context.previous);
			}

			setSaveError(t("profile.locationScreen.saveError"));
		},
	});

	const busy = saveMutation.isPending || profile.isPending || deviceBusy;
	const disabled = busy || !profile.data;

	const savePatch = (updates: Record<string, string | number | boolean | null>) => {
		saveMutation.mutate(updates);
	};

	const onPresetChange = (nextPreset: LocationPresetId) => {
		if (nextPreset === "device") {
			setPresetId("device");
			void onUseDeviceLocation();
			return;
		}

		void onHideLocation();
	};

	const onHideLocation = async () => {
		setDeviceBusy(true);
		setSaveError(null);
		setPresetId("hidden");

		try {
			const updates = buildHiddenLocationPayload();
			const updatedProfile = await withTimeout(saveProfileSettings(updates), SAVE_TIMEOUT_MS, "save timeout");
			mergeProfileCache(queryClient, updates, updatedProfile);
			refreshProfileCache(queryClient);
		} catch {
			setSaveError(t("profile.locationScreen.saveError"));
			setPresetId(resolveLocationPreset(profile.data));
		} finally {
			setDeviceBusy(false);
		}
	};

	const onUseDeviceLocation = async () => {
		if (deviceBusy) {
			return;
		}

		setDeviceBusy(true);
		setSaveError(null);
		setPresetId("device");

		try {
			const location = await readDeviceLocation(t("profile.locationScreen.deviceLabel"), { fresh: true });
			const updates = {
				locationHidden: false,
				displayLocation: location.label,
				latitude: location.latitude,
				longitude: location.longitude,
			};

			mergeProfileCache(queryClient, updates);
			const updatedProfile = await withTimeout(saveProfileSettings(updates), SAVE_TIMEOUT_MS, "save timeout");
			mergeProfileCache(queryClient, updates, updatedProfile);
			refreshProfileCache(queryClient);
		} catch (error) {
			setPresetId(resolveLocationPreset(profile.data));

			if (error instanceof DeviceLocationError) {
				const messageByReason = {
					permission_denied: t("profile.locationScreen.permissionDenied"),
					services_disabled: t("profile.locationScreen.servicesDisabled"),
					unavailable: t("profile.locationScreen.deviceUnavailable"),
					timeout: t("profile.locationScreen.deviceTimeout"),
				} as const;

				setSaveError(messageByReason[error.reason]);

				if (error.reason === "permission_denied") {
					void Linking.openSettings();
				}

				return;
			}

			setSaveError(
				error instanceof Error && error.message.includes("save")
					? t("profile.locationScreen.saveError")
					: t("profile.locationScreen.deviceError"),
			);
		} finally {
			setDeviceBusy(false);
		}
	};

	return (
		<FormScreen title={t("profile.locationScreen.title")} subtitle={t("profile.locationScreen.subtitle")} showBack>
			{saveError ? <ErrorBanner message={saveError} /> : null}

			<MenuCard>
				<View style={styles.section}>
					<ThemedText type="label">{t("profile.locationScreen.displayTitle")}</ThemedText>
					<ThemedText type="caption" style={styles.hint}>
						{t("profile.locationScreen.displayHint")}
					</ThemedText>
					<ChipGroup<LocationPresetId>
						label={t("profile.locationScreen.displayTitle")}
						options={presetOptions}
						value={presetId}
						onChange={onPresetChange}
					/>
					{presetId === "device" || deviceBusy ? (
						<Button
							label={t("profile.locationScreen.useDevice")}
							onPress={() => void onUseDeviceLocation()}
							disabled={disabled}
							loading={deviceBusy}
						/>
					) : null}
				</View>
			</MenuCard>

			<MenuCard>
				<View style={styles.sectionHeader}>
					<ThemedText type="label">{t("profile.locationScreen.sharingTitle")}</ThemedText>
					{busy ? <ActivityIndicator size="small" /> : null}
				</View>
				<SettingToggleRow
					label={t("profile.locationScreen.shareProximity")}
					subtitle={t("profile.locationScreen.shareProximityHint")}
					value={settings.shareLocation}
					onValueChange={(value) => savePatch({ shareLocation: value })}
					disabled={disabled}
				/>
				<SettingToggleRow
					label={t("profile.locationScreen.shareCrossPaths")}
					subtitle={t("profile.locationScreen.shareCrossPathsHint")}
					value={settings.shareCrossPaths}
					onValueChange={(value) => savePatch({ shareCrossPaths: value })}
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
	section: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.lg,
		gap: Spacing.md,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: Spacing.lg,
		paddingTop: Spacing.lg,
		paddingBottom: Spacing.xs,
	},
	hint: {
		opacity: 0.85,
	},
	footerHint: {
		paddingHorizontal: Spacing.sm,
		opacity: 0.85,
		lineHeight: 20,
	},
});

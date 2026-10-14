import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { LocationCard } from "@/components/profile/location-card";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { MenuCard, MenuDivider } from "@/components/ui/menu-row";
import { SettingToggleRow } from "@/components/ui/setting-toggle-row";
import { Spacing } from "@/constants/app-config";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { useTheme } from "@/hooks/use-theme";
import { type ProfileDraft, useProfileDraft } from "@/lib/onboarding/profile-draft";
import {
	nextOnboardingRoute,
	ONBOARDING_STEP_COUNT,
	onboardingStepNumber,
	previousOnboardingRoute,
} from "@/lib/onboarding/steps";
import type { LocationPresetId } from "@/lib/profile/location";

const CLEARED_LOCATION = { displayLocation: null, latitude: null, longitude: null };

export default function LocationStep() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { draft, updateDraft } = useProfileDraft();
	const device = useDeviceLocation();
	const { location } = draft;

	const setLocation = (partial: Partial<ProfileDraft["location"]>) => {
		updateDraft({ location: { ...location, ...partial } });
	};

	const onUseDeviceLocation = async () => {
		const result = await device.read();

		if (result) {
			const { label, latitude, longitude } = result;
			setLocation({ preset: "device", displayLocation: label, latitude, longitude });
		} else if (location.latitude === null) {
			setLocation({ preset: undefined, ...CLEARED_LOCATION });
		}
	};

	const onPresetChange = (preset: LocationPresetId) => {
		if (preset === "device") {
			void onUseDeviceLocation();
			return;
		}

		device.setError(undefined);
		setLocation({ preset: "hidden", ...CLEARED_LOCATION });
	};

	const onContinue = () => {
		const next = nextOnboardingRoute("location");
		if (next) {
			router.replace(next);
		}
	};

	return (
		<FormScreen
			title={t("onboarding.location.title")}
			subtitle={t("onboarding.location.subtitle")}
			showBack
			onBack={() => router.replace(previousOnboardingRoute("location"))}
			progress={{ current: onboardingStepNumber("location"), total: ONBOARDING_STEP_COUNT }}
			footer={
				<>
					<ErrorBanner message={device.error} />
					<Button label={t("common.continue")} onPress={onContinue} disabled={device.busy} />
				</>
			}
		>
			<LocationCard
				preset={location.preset}
				displayLocation={location.displayLocation}
				busy={device.busy}
				onPresetChange={onPresetChange}
				onRefresh={() => void onUseDeviceLocation()}
			/>

			<MenuCard>
				<SettingToggleRow
					label={t("profile.locationScreen.shareProximity")}
					subtitle={t("profile.locationScreen.shareProximityHint")}
					value={location.shareLocation}
					onValueChange={(shareLocation) => setLocation({ shareLocation })}
				/>
				<MenuDivider />
				<SettingToggleRow
					label={t("profile.locationScreen.shareCrossPaths")}
					subtitle={t("profile.locationScreen.shareCrossPathsHint")}
					value={location.shareCrossPaths}
					onValueChange={(shareCrossPaths) => setLocation({ shareCrossPaths })}
				/>
			</MenuCard>

			<ThemedText type="caption" style={{ color: theme.muted, paddingHorizontal: Spacing.sm }}>
				{t("onboarding.location.crossPathsHint")}
			</ThemedText>
		</FormScreen>
	);
}

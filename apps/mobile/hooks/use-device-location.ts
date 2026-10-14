import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking } from "react-native";

import {
	DEVICE_LOCATION_ERROR_KEYS,
	DeviceLocationError,
	type DeviceLocationResult,
	readDeviceLocation,
} from "@/lib/profile/device-location";

/** Reads the device location once at a time and maps failures to copy; resolves null on failure. */
export function useDeviceLocation() {
	const { t } = useTranslation();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);
	const inFlight = useRef(false);

	const read = async (): Promise<DeviceLocationResult | null> => {
		if (inFlight.current) {
			return null;
		}

		inFlight.current = true;
		setBusy(true);
		setError(undefined);

		try {
			return await readDeviceLocation(t("profile.locationScreen.deviceLabel"));
		} catch (caught) {
			if (!(caught instanceof DeviceLocationError)) {
				setError(t("profile.locationScreen.deviceError"));
				return null;
			}

			setError(t(DEVICE_LOCATION_ERROR_KEYS[caught.reason]));

			if (caught.reason === "permission_denied") {
				void Linking.openSettings();
			}

			return null;
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	};

	return { busy, error, setError, read };
}

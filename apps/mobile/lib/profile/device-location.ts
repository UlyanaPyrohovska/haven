import * as Location from "expo-location";

export type DeviceLocationResult = {
	latitude: number;
	longitude: number;
	label: string;
};

export type DeviceLocationFailureReason = "permission_denied" | "services_disabled" | "unavailable" | "timeout";

export class DeviceLocationError extends Error {
	constructor(readonly reason: DeviceLocationFailureReason) {
		super(reason);
	}
}

export const DEVICE_LOCATION_ERROR_KEYS = {
	permission_denied: "profile.locationScreen.permissionDenied",
	services_disabled: "profile.locationScreen.servicesDisabled",
	unavailable: "profile.locationScreen.deviceUnavailable",
	timeout: "profile.locationScreen.deviceTimeout",
} as const;

const POSITION_TIMEOUT_MS = 10_000;
const GEOCODE_TIMEOUT_MS = 5_000;
/** A cached fix this recent is as good as a new one for an area-level location. */
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;
const LAST_KNOWN_MAX_ACCURACY_M = 3_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new DeviceLocationError("timeout")), timeoutMs);
	});

	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function resolveLocationLabel(latitude: number, longitude: number, fallbackLabel: string): Promise<string> {
	try {
		const [place] = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), GEOCODE_TIMEOUT_MS);
		const parts = [place?.city?.trim() || place?.region?.trim(), place?.country?.trim()].filter(Boolean);

		return parts.length > 0 ? parts.join(", ") : fallbackLabel;
	} catch {
		return fallbackLabel;
	}
}

async function readPosition(): Promise<Location.LocationObject> {
	const recent = await Location.getLastKnownPositionAsync({
		maxAge: LAST_KNOWN_MAX_AGE_MS,
		requiredAccuracy: LAST_KNOWN_MAX_ACCURACY_M,
	});

	if (recent) {
		return recent;
	}

	try {
		// Haven only shows an approximate area, so a coarse fix is enough and resolves much faster than GPS.
		return await withTimeout(
			Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low, mayShowUserSettingsDialog: true }),
			POSITION_TIMEOUT_MS,
		);
	} catch (error) {
		const stale = await Location.getLastKnownPositionAsync();

		if (stale) {
			return stale;
		}

		throw error instanceof DeviceLocationError ? error : new DeviceLocationError("unavailable");
	}
}

export async function readDeviceLocation(fallbackLabel: string): Promise<DeviceLocationResult> {
	const [servicesEnabled, permission] = await Promise.all([
		Location.hasServicesEnabledAsync(),
		Location.requestForegroundPermissionsAsync(),
	]);

	if (!servicesEnabled) {
		throw new DeviceLocationError("services_disabled");
	}

	if (!permission.granted) {
		throw new DeviceLocationError("permission_denied");
	}

	const { latitude, longitude } = (await readPosition()).coords;
	const label = await resolveLocationLabel(latitude, longitude, fallbackLabel);

	return { latitude, longitude, label };
}

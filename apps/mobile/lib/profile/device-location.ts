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

const POSITION_TIMEOUT_MS = 20_000;
const FRESH_POSITION_TIMEOUT_MS = 12_000;
const GEOCODE_TIMEOUT_MS = 8_000;

function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	reason: DeviceLocationFailureReason = "timeout",
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new DeviceLocationError(reason)), timeoutMs);

		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

async function resolveLocationLabel(latitude: number, longitude: number, fallbackLabel: string): Promise<string> {
	try {
		const places = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), GEOCODE_TIMEOUT_MS);
		const place = places[0];

		if (!place) {
			return fallbackLabel;
		}

		const city = typeof place.city === "string" ? place.city.trim() : "";
		const country = typeof place.country === "string" ? place.country.trim() : "";
		const region = typeof place.region === "string" ? place.region.trim() : "";

		if (city && country) {
			return `${city}, ${country}`;
		}

		const parts = [city || region, country].filter((part) => part.length > 0);

		return parts.length > 0 ? parts.join(", ") : fallbackLabel;
	} catch {
		return fallbackLabel;
	}
}

async function readCurrentPosition(timeoutMs: number): Promise<Location.LocationObject> {
	return withTimeout(
		Location.getCurrentPositionAsync({
			accuracy: Location.Accuracy.Balanced,
			mayShowUserSettingsDialog: true,
		}),
		timeoutMs,
	);
}

async function readPosition(fresh = false): Promise<Location.LocationObject | null> {
	if (!fresh) {
		const lastKnown = await Location.getLastKnownPositionAsync();

		if (lastKnown) {
			return lastKnown;
		}

		return readCurrentPosition(POSITION_TIMEOUT_MS);
	}

	try {
		return await readCurrentPosition(FRESH_POSITION_TIMEOUT_MS);
	} catch (error) {
		const lastKnown = await Location.getLastKnownPositionAsync();

		if (lastKnown) {
			return lastKnown;
		}

		throw error;
	}
}

type ReadDeviceLocationOptions = {
	/** Skip cached GPS fixes and request a fresh reading. Use when the user explicitly updates location. */
	fresh?: boolean;
};

export async function readDeviceLocation(
	fallbackLabel: string,
	options: ReadDeviceLocationOptions = {},
): Promise<DeviceLocationResult> {
	const servicesEnabled = await Location.hasServicesEnabledAsync();

	if (!servicesEnabled) {
		throw new DeviceLocationError("services_disabled");
	}

	const permission = await Location.requestForegroundPermissionsAsync();

	if (!permission.granted) {
		throw new DeviceLocationError("permission_denied");
	}

	const position = await readPosition(options.fresh ?? false);

	if (!position) {
		throw new DeviceLocationError("unavailable");
	}

	const { latitude, longitude } = position.coords;
	const label = await resolveLocationLabel(latitude, longitude, fallbackLabel);

	return { latitude, longitude, label };
}

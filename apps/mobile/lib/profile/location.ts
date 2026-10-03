import type { ProfileRecord } from "@/lib/api/profile";

export type LocationPresetId = "device" | "hidden";

export type LocationPreset = {
	id: LocationPresetId;
	labelKey: "profile.locationScreen.presets.device" | "profile.locationScreen.presets.hidden";
};

export const LOCATION_PRESETS: readonly LocationPreset[] = [
	{ id: "device", labelKey: "profile.locationScreen.presets.device" },
	{ id: "hidden", labelKey: "profile.locationScreen.presets.hidden" },
];

export type LocationSettings = {
	displayLocation: string | null;
	locationHidden: boolean;
	shareLocation: boolean;
	shareCrossPaths: boolean;
	latitude: number | null;
	longitude: number | null;
};

function readString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();

	return trimmed.length > 0 ? trimmed : null;
}

function readProfileString(record: ProfileRecord, camelKey: string, snakeKey: string): string | null {
	return readString(record[camelKey] ?? record[snakeKey]);
}

function readProfileFlag(record: ProfileRecord, camelKey: string, snakeKey: string): boolean {
	const value = record[camelKey] ?? record[snakeKey];

	return value === true || value === 1 || value === "true";
}

function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFlag(profile: ProfileRecord, key: "shareLocation" | "shareCrossPaths"): boolean {
	return profile[key] !== false;
}

export function readLocationSettings(profile: ProfileRecord | null | undefined): LocationSettings {
	const record = profile ?? {};

	return {
		displayLocation: readProfileString(record, "displayLocation", "display_location"),
		locationHidden: readProfileFlag(record, "locationHidden", "location_hidden"),
		shareLocation: readFlag(record, "shareLocation"),
		shareCrossPaths: readFlag(record, "shareCrossPaths"),
		latitude: readNumber(record.latitude),
		longitude: readNumber(record.longitude),
	};
}

export function resolveLocationPreset(profile: ProfileRecord | null | undefined): LocationPresetId | undefined {
	const settings = readLocationSettings(profile);

	if (settings.locationHidden) {
		return "hidden";
	}

	if (settings.latitude !== null && settings.longitude !== null) {
		return "device";
	}

	return undefined;
}

export function headerLocationDisplay(
	profile: ProfileRecord | null | undefined,
	unsetLabel: string,
	hiddenLabel: string,
): { label: string; hidden: boolean; unset: boolean; visible: boolean } {
	const settings = readLocationSettings(profile);

	if (settings.locationHidden) {
		return { label: hiddenLabel, hidden: true, unset: false, visible: true };
	}

	if (settings.displayLocation) {
		return { label: settings.displayLocation, hidden: false, unset: false, visible: true };
	}

	return { label: unsetLabel, hidden: false, unset: true, visible: true };
}

export function locationSettingsSummary(
	profile: ProfileRecord | null | undefined,
	unsetLabel: string,
	hiddenLabel: string,
): string {
	return headerLocationDisplay(profile, unsetLabel, hiddenLabel).label;
}

export function buildHiddenLocationPayload(): Record<string, string | number | boolean | null> {
	return {
		locationHidden: true,
		displayLocation: null,
		latitude: null,
		longitude: null,
	};
}

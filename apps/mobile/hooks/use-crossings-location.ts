import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { mergeProfileCache } from "@/hooks/use-profile";
import { type ProfileRecord, saveProfileSettings } from "@/lib/api/profile";
import { readDeviceLocation } from "@/lib/profile/device-location";
import { readLocationSettings } from "@/lib/profile/location";

/** Foreground refreshes closer than this are skipped; the API also counts a pair at most every 6 h. */
const REFRESH_INTERVAL_MS = 10 * 60_000;

/**
 * Sends a coarse device location when the app comes to the foreground, so the API can count crossed paths.
 * Only for users who share their device location and cross paths, and only with permission already granted:
 * it never prompts and never runs in the background.
 */
export function useCrossingsLocation(profile: ProfileRecord | null | undefined) {
	const queryClient = useQueryClient();
	const lastSentAt = useRef(0);
	const settings = readLocationSettings(profile);
	const enabled =
		settings.shareCrossPaths && !settings.locationHidden && settings.latitude !== null && settings.longitude !== null;
	const fallbackLabel = settings.displayLocation ?? "";

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const refresh = async () => {
			if (Date.now() - lastSentAt.current < REFRESH_INTERVAL_MS) {
				return;
			}

			lastSentAt.current = Date.now();

			try {
				if (!(await Location.getForegroundPermissionsAsync()).granted) {
					return;
				}

				const location = await readDeviceLocation(fallbackLabel);
				const serverProfile = await saveProfileSettings({
					...(location.label ? { displayLocation: location.label } : {}),
					latitude: location.latitude,
					longitude: location.longitude,
				});
				mergeProfileCache(queryClient, {}, serverProfile);
			} catch {
				// Best effort: a missed refresh only delays a crossing.
			}
		};

		void refresh();
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				void refresh();
			}
		});

		return () => subscription.remove();
	}, [enabled, fallbackLabel, queryClient]);
}

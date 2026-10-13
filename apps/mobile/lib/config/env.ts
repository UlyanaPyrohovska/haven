import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API base URL — set via env files or scripts:
 * - `pnpm dev` → `.env.dev` (localhost)
 * - `pnpm dev:prod` → `.env.production` (deployed Worker)
 * - `eas build` → env in `eas.json` (production API)
 *
 * On a physical device in local mode, override in `.env.dev.local`.
 * Rebuild the dev client after changing env vars baked into a native build.
 */
function resolveApiUrl(): string {
	const configured = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

	// Android emulator: `localhost` is the emulator itself; host loopback is 10.0.2.2.
	if (
		Platform.OS === "android" &&
		!Constants.isDevice &&
		configured.includes("localhost")
	) {
		return configured.replace("localhost", "10.0.2.2");
	}

	return configured;
}

export const API_URL = resolveApiUrl();

/** Better Auth is mounted at `/auth` on the API, so the client needs the full path. */
export const AUTH_BASE_URL = `${API_URL}/auth`;

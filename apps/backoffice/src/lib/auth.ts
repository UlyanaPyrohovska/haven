import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Must match API `basePath: "/auth"` (same as mobile `AUTH_BASE_URL`). */
function resolveAuthBaseUrl() {
	if (typeof window === "undefined") {
		return "";
	}

	const fromEnv = import.meta.env.VITE_AUTH_BASE_URL?.trim();
	if (fromEnv) {
		return fromEnv.replace(/\/$/, "");
	}

	return `${window.location.origin}/auth`;
}

export const authClient = createAuthClient({
	baseURL: resolveAuthBaseUrl(),
	plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;

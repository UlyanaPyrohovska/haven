import type { router as expoRouter } from "expo-router";

type Router = typeof expoRouter;

import { fetchProfile } from "@/lib/api/profile";
import { authClient } from "@/lib/auth/client";

const SESSION_RETRY_ATTEMPTS = 10;
const SESSION_RETRY_DELAY_MS = 50;

type AuthActionResult = { user?: unknown; token?: string | null } | null | undefined;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** sign-in/sign-up responses include a user when credentials were accepted. */
export function isAuthenticatedResult(result: AuthActionResult): boolean {
	return result != null && typeof result === "object" && result.user != null;
}

/**
 * Reloads the Better Auth session atom. Retries because the Expo plugin persists
 * cookies asynchronously — a single refetch right after sign-in often runs before
 * SecureStore is readable.
 */
export async function refreshAuthSession(): Promise<boolean> {
	for (let attempt = 0; attempt < SESSION_RETRY_ATTEMPTS; attempt++) {
		if (attempt > 0) {
			await delay(SESSION_RETRY_DELAY_MS * attempt);
		}

		await authClient.$store.atoms.session.get().refetch();

		if (authClient.$store.atoms.session.get().data != null) {
			return true;
		}
	}

	return false;
}

async function fetchProfileWithRetry() {
	for (let attempt = 0; attempt < SESSION_RETRY_ATTEMPTS; attempt++) {
		if (attempt > 0) {
			await delay(SESSION_RETRY_DELAY_MS * attempt);
		}

		try {
			return await fetchProfile();
		} catch {
			// Cookie may not be attached yet; try again.
		}
	}

	throw new Error("Profile fetch failed after retries");
}

/** Waits for the session store, then routes straight to the right screen (skips the index gate). */
export async function navigateAfterAuth(router: Router, authResult?: AuthActionResult): Promise<void> {
	const hasSession = isAuthenticatedResult(authResult) || (await refreshAuthSession());

	if (!hasSession) {
		// Session still settling — let the index gate finish loading instead of showing an error.
		router.replace("/");
		return;
	}

	try {
		const profile = await fetchProfileWithRetry();
		router.replace(profile ? "/home" : "/basics");
	} catch {
		router.replace("/");
	}
}

/** Drops the whole stack before showing login so signed-in screens unmount and stop refetching. */
export function resetToLogin(router: Router): void {
	if (router.canDismiss()) {
		router.dismissAll();
	}
	router.replace("/login");
}

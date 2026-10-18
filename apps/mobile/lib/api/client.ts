import { authClient } from "@/lib/auth/client";
import { signOutOnUnauthorized } from "@/lib/auth/unauthorized";
import { API_URL } from "@/lib/config/env";

/**
 * Fetch against the Haven API with the Better Auth session attached. The cookie is set
 * explicitly because React Native has no cookie jar, so `credentials` stays off.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const cookie = authClient.getCookie();

	const response = await fetch(`${API_URL}${path}`, {
		...init,
		credentials: "omit",
		headers: {
			"Content-Type": "application/json",
			...(cookie ? { Cookie: cookie } : {}),
			...init.headers,
		},
	});

	// No cookie means already signed out; signing out again would loop navigation to login.
	if (response.status === 401 && cookie) {
		void signOutOnUnauthorized();
	}

	return response;
}

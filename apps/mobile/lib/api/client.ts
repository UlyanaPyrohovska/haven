import { authClient } from "@/lib/auth-client";
import { API_URL } from "@/lib/env";

/**
 * Fetch against the Haven API with the Better Auth session attached. The cookie is set
 * explicitly because React Native has no cookie jar, so `credentials` stays off.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const cookie = authClient.getCookie();

	return fetch(`${API_URL}${path}`, {
		...init,
		credentials: "omit",
		headers: {
			"Content-Type": "application/json",
			...(cookie ? { Cookie: cookie } : {}),
			...init.headers,
		},
	});
}

import { signOut } from "@/lib/auth/client";

type UnauthorizedHandler = () => void | Promise<void>;

let handler: UnauthorizedHandler | null = null;
let signOutInFlight: Promise<void> | null = null;

/** Called from the root layout so 401 responses can clear cache and navigate to login. */
export function setUnauthorizedHandler(next: UnauthorizedHandler | null) {
	handler = next;
}

/** Signs out once per burst of 401s, then runs the registered navigation/cache cleanup. */
export function signOutOnUnauthorized(): Promise<void> {
	if (signOutInFlight) {
		return signOutInFlight;
	}

	signOutInFlight = (async () => {
		try {
			await signOut();
			await handler?.();
		} catch {
			// Still run navigation so the user is not stuck on a broken session.
			await handler?.();
		} finally {
			signOutInFlight = null;
		}
	})();

	return signOutInFlight;
}

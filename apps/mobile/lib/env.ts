/**
 * `localhost` only resolves for simulators. On a physical device set
 * `EXPO_PUBLIC_API_URL` to your machine's LAN address (see `.env.example`).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

/** Better Auth is mounted at `/auth` on the API, so the client needs the full path. */
export const AUTH_BASE_URL = `${API_URL}/auth`;

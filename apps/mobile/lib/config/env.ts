/**
 * API base URL — set via env files or scripts:
 * - `pnpm dev` → `.env.dev` (localhost)
 * - `pnpm dev:prod` → `.env.production` (deployed Worker)
 * - `eas build` → `.env.production`
 *
 * On a physical device in local mode, override in `.env.dev.local`.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

/** Better Auth is mounted at `/auth` on the API, so the client needs the full path. */
export const AUTH_BASE_URL = `${API_URL}/auth`;

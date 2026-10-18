import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { AUTH_BASE_URL } from "@/lib/config/env";

export const authClient = createAuthClient({
	baseURL: AUTH_BASE_URL,
	plugins: [
		expoClient({
			scheme: "haven",
			storagePrefix: "haven",
			storage: SecureStore,
		}),
	],
});

/** The reset email's link redirects here with `?token=` (or `?error=` when the token is bad). */
export const RESET_PASSWORD_REDIRECT_URL = "haven://reset-password";

export const { signIn, signUp, signOut, useSession, updateUser } = authClient;

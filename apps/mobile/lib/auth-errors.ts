import { Strings } from "@/constants/strings";

export type AuthErrorLike = {
	code?: string | undefined;
	message?: string | undefined;
	status?: number | undefined;
};

/** Maps a Better Auth client error onto user-facing copy. */
export function describeAuthError(error: AuthErrorLike | null | undefined): string {
	if (!error) {
		return Strings.auth.errors.generic;
	}

	switch (error.code) {
		case "INVALID_EMAIL_OR_PASSWORD":
		case "INVALID_PASSWORD":
			return Strings.auth.errors.invalidCredentials;
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return Strings.auth.errors.emailTaken;
		default:
			break;
	}

	// A failed request never reaches the server, so it carries no HTTP status.
	if (!error.status) {
		return Strings.auth.errors.network;
	}

	return Strings.auth.errors.generic;
}

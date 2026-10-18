import i18n from "@/lib/i18n";

export type AuthErrorLike = {
	code?: string | undefined;
	message?: string | undefined;
	status?: number | undefined;
};

/** Maps a Better Auth client error onto user-facing copy. */
export function describeAuthError(error: AuthErrorLike | null | undefined): string {
	if (!error) {
		return i18n.t("auth.errors.generic");
	}

	switch (error.code) {
		case "INVALID_EMAIL_OR_PASSWORD":
		case "INVALID_PASSWORD":
			return i18n.t("auth.errors.invalidCredentials");
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return i18n.t("auth.errors.emailTaken");
		case "EMAIL_NOT_VERIFIED":
			return i18n.t("auth.errors.emailNotVerified");
		default:
			break;
	}

	// A failed request never reaches the server, so it carries no HTTP status.
	if (!error.status) {
		return i18n.t("auth.errors.network");
	}

	return i18n.t("auth.errors.generic");
}

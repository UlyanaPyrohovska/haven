import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";
import { FormScreen } from "@/components/ui/form-screen";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth/client";
import { navigateAfterAuth } from "@/lib/auth/navigation";

/**
 * Opened from the emailed link (via the API's /links/verify-email redirect). Redeeming the token here,
 * not in the browser, lets the Expo client store the session cookie, so the user lands signed in.
 */
export default function VerifyEmailScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { token } = useLocalSearchParams<{ token?: string }>();
	// Tokens are single-use; guard against a second run in dev double-mount.
	const started = useRef(false);

	useEffect(() => {
		if (started.current) {
			return;
		}
		started.current = true;

		(async () => {
			const result = token ? await authClient.verifyEmail({ query: { token } }) : null;
			if (!result || result.error) {
				router.replace({ pathname: "/login", params: { error: "verify" } });
				return;
			}
			await navigateAfterAuth(router);
		})();
	}, [token, router]);

	return (
		<FormScreen title={t("auth.verify.title")} centered>
			<ActivityIndicator color={theme.tint} />
		</FormScreen>
	);
}

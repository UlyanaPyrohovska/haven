import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { authClient } from "@/lib/auth/client";
import { describeAuthError } from "@/lib/auth/errors";
import { type ValidationError, validateConfirmPassword, validatePassword } from "@/lib/utils/validation";

/** Opened from the reset email: the API redirects to haven://reset-password?token=… or ?error=INVALID_TOKEN. */
export default function ResetPasswordScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const params = useLocalSearchParams<{ token?: string; error?: string }>();

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [errors, setErrors] = useState<{ password?: ValidationError; confirmPassword?: ValidationError }>({});
	const [linkInvalid, setLinkInvalid] = useState(!params.token || Boolean(params.error));
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		const nextErrors = {
			password: validatePassword(password),
			confirmPassword: validateConfirmPassword(password, confirmPassword),
		};
		setErrors(nextErrors);
		setFormError(undefined);

		if (!params.token || nextErrors.password || nextErrors.confirmPassword) {
			return;
		}

		setSubmitting(true);
		const { error } = await authClient.resetPassword({ newPassword: password, token: params.token });
		setSubmitting(false);

		if (error?.code === "INVALID_TOKEN") {
			setLinkInvalid(true);
			return;
		}
		if (error) {
			setFormError(describeAuthError(error));
			return;
		}

		router.replace({ pathname: "/login", params: { notice: "passwordReset" } });
	};

	if (linkInvalid) {
		return (
			<FormScreen
				title={t("auth.reset.title")}
				showBack
				onBack={() => router.replace("/login")}
				footer={<Button label={t("auth.reset.requestNew")} onPress={() => router.replace("/forgot-password")} />}
			>
				<ErrorBanner message={t("auth.notices.resetLinkInvalid")} />
			</FormScreen>
		);
	}

	return (
		<FormScreen
			title={t("auth.reset.title")}
			showBack
			onBack={() => router.replace("/login")}
			footer={
				<>
					<ErrorBanner message={formError} />
					<Button label={t("auth.reset.submit")} loading={submitting} onPress={onSubmit} />
				</>
			}
		>
			<TextField
				label={t("auth.fields.password")}
				placeholder={t("auth.fields.passwordPlaceholder")}
				value={password}
				onChangeText={setPassword}
				error={errors.password}
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				secureTextEntry
				returnKeyType="next"
			/>

			<TextField
				label={t("auth.fields.confirmPassword")}
				placeholder={t("auth.fields.confirmPasswordPlaceholder")}
				value={confirmPassword}
				onChangeText={setConfirmPassword}
				error={errors.confirmPassword}
				autoCapitalize="none"
				autoComplete="new-password"
				textContentType="newPassword"
				secureTextEntry
				returnKeyType="go"
				onSubmitEditing={onSubmit}
			/>
		</FormScreen>
	);
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { authClient, RESET_PASSWORD_REDIRECT_URL } from "@/lib/auth/client";
import { describeAuthError } from "@/lib/auth/errors";
import { type ValidationError, validateEmail } from "@/lib/utils/validation";

export default function ForgotPasswordScreen() {
	const { t } = useTranslation();

	const [email, setEmail] = useState("");
	const [emailError, setEmailError] = useState<ValidationError>(undefined);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [sent, setSent] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		const nextError = validateEmail(email);
		setEmailError(nextError);
		setFormError(undefined);

		if (nextError) {
			return;
		}

		setSubmitting(true);
		const { error } = await authClient.requestPasswordReset({
			email: email.trim(),
			redirectTo: RESET_PASSWORD_REDIRECT_URL,
		});
		setSubmitting(false);

		if (error) {
			setFormError(describeAuthError(error));
			return;
		}

		// Same message whether or not the account exists, so the form can't be used to probe emails.
		setSent(true);
	};

	return (
		<FormScreen
			title={t("auth.forgot.title")}
			subtitle={t("auth.forgot.subtitle")}
			showBack
			footer={
				<>
					<ErrorBanner message={formError} />
					{sent && !formError && <ErrorBanner message={t("auth.forgot.sent")} tone="info" />}
					<Button label={t("auth.forgot.submit")} loading={submitting} onPress={onSubmit} />
				</>
			}
		>
			<TextField
				label={t("auth.fields.email")}
				placeholder={t("auth.fields.emailPlaceholder")}
				value={email}
				onChangeText={setEmail}
				error={emailError}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				textContentType="emailAddress"
				returnKeyType="go"
				onSubmitEditing={onSubmit}
			/>
		</FormScreen>
	);
}

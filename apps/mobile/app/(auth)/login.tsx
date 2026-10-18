import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { BrandHero } from "@/components/brand-hero";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { Spacing, TextStyles } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { signIn } from "@/lib/auth/client";
import { describeAuthError } from "@/lib/auth/errors";
import { navigateAfterAuth } from "@/lib/auth/navigation";
import { type ValidationError, validateEmail, validatePassword } from "@/lib/utils/validation";

export default function LoginScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	// notice: checkEmail after sign-up, passwordReset after a reset. error: an emailed link was bad.
	const params = useLocalSearchParams<{ notice?: "checkEmail" | "passwordReset"; error?: string }>();
	const notice = params.notice ? t(`auth.notices.${params.notice}`) : undefined;

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<{ email?: ValidationError; password?: ValidationError }>({});
	const [formError, setFormError] = useState<string | undefined>(
		params.error ? t("auth.notices.verifyLinkInvalid") : undefined,
	);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		const nextErrors = { email: validateEmail(email), password: validatePassword(password) };
		setErrors(nextErrors);
		setFormError(undefined);

		if (nextErrors.email || nextErrors.password) {
			return;
		}

		setSubmitting(true);
		const { data, error } = await signIn.email({ email: email.trim(), password });

		if (error) {
			setSubmitting(false);
			setFormError(describeAuthError(error));
			return;
		}

		await navigateAfterAuth(router, data);
	};

	return (
		<FormScreen
			title={t("auth.login.title")}
			hero={<BrandHero tagline={t("app.tagline")} />}
			centered
			footer={
				<>
					<ErrorBanner message={formError} />
					{!formError && <ErrorBanner message={notice} tone="info" />}
					<Button label={t("auth.login.submit")} loading={submitting} onPress={onSubmit} />
					<Button
						label={t("auth.login.createAccount")}
						variant="secondary"
						onPress={() => router.replace("/register")}
					/>
				</>
			}
		>
			<TextField
				label={t("auth.fields.email")}
				placeholder={t("auth.fields.emailPlaceholder")}
				value={email}
				onChangeText={setEmail}
				error={errors.email}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				textContentType="emailAddress"
				returnKeyType="next"
			/>

			<TextField
				label={t("auth.fields.password")}
				placeholder={t("auth.fields.enterPassword")}
				value={password}
				onChangeText={setPassword}
				error={errors.password}
				autoCapitalize="none"
				autoComplete="current-password"
				textContentType="password"
				secureTextEntry
				returnKeyType="go"
				onSubmitEditing={onSubmit}
			/>

			<Link href="/forgot-password" style={[TextStyles.caption, styles.forgotLink, { color: theme.link }]}>
				{t("auth.login.forgotPassword")}
			</Link>
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	forgotLink: {
		alignSelf: "flex-end",
		paddingVertical: Spacing.xs,
		textDecorationLine: "underline",
	},
});

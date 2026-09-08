import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { BrandHero } from "@/components/brand-hero";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { Spacing, TextStyles } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { useTranslation } from "react-i18next";
import { signIn } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { navigateAfterAuth } from "@/lib/auth-navigation";
import { type ValidationError, validateEmail, validatePassword } from "@/lib/validation";

export default function LoginScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [errors, setErrors] = useState<{ email?: ValidationError; password?: ValidationError }>({});
	const [formError, setFormError] = useState<string | undefined>(undefined);
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
					<Button label={t("auth.login.submit")} loading={submitting} onPress={onSubmit} />
					<View style={styles.footerRow}>
						<ThemedText type="caption" style={{ color: theme.muted }}>
							{t("auth.login.footerPrompt")}
						</ThemedText>
						<Link href="/register" replace style={[TextStyles.caption, styles.footerLink, { color: theme.link }]}>
							{t("auth.login.footerAction")}
						</Link>
					</View>
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
		</FormScreen>
	);
}

const styles = StyleSheet.create({
	footerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
	},
	footerLink: {
		textDecorationLine: "underline",
	},
});

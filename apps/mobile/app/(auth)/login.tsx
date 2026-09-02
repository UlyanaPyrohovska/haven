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
import { Strings } from "@/constants/strings";
import { useTheme } from "@/hooks/use-theme";
import { signIn } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { navigateAfterAuth } from "@/lib/auth-navigation";
import { type ValidationError, validateEmail, validatePassword } from "@/lib/validation";

const copy = Strings.auth;

export default function LoginScreen() {
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
			title={copy.login.title}
			hero={<BrandHero tagline={Strings.app.tagline} />}
			centered
			footer={
				<>
					<ErrorBanner message={formError} />
					<Button label={copy.login.submit} loading={submitting} onPress={onSubmit} />
					<View style={styles.footerRow}>
						<ThemedText type="caption" style={{ color: theme.muted }}>
							{copy.login.footerPrompt}
						</ThemedText>
						<Link href="/register" replace style={[TextStyles.caption, styles.footerLink, { color: theme.link }]}>
							{copy.login.footerAction}
						</Link>
					</View>
				</>
			}
		>
			<TextField
				label={copy.fields.email}
				placeholder={copy.fields.emailPlaceholder}
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
				label={copy.fields.password}
				placeholder={copy.fields.enterPassword}
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

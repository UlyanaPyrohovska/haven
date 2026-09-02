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
import { signUp } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth-errors";
import { isAuthenticatedResult, refreshAuthSession } from "@/lib/auth-navigation";
import {
	type ValidationError,
	validateConfirmPassword,
	validateEmail,
	validateName,
	validatePassword,
} from "@/lib/validation";

const copy = Strings.auth;

type RegisterErrors = {
	name?: ValidationError;
	email?: ValidationError;
	password?: ValidationError;
	confirmPassword?: ValidationError;
};

export default function RegisterScreen() {
	const theme = useTheme();
	const router = useRouter();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [errors, setErrors] = useState<RegisterErrors>({});
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		const nextErrors: RegisterErrors = {
			name: validateName(name),
			email: validateEmail(email),
			password: validatePassword(password),
			confirmPassword: validateConfirmPassword(password, confirmPassword),
		};
		setErrors(nextErrors);
		setFormError(undefined);

		if (Object.values(nextErrors).some(Boolean)) {
			return;
		}

		setSubmitting(true);
		const { data, error } = await signUp.email({ name: name.trim(), email: email.trim(), password });

		if (error) {
			setSubmitting(false);
			setFormError(describeAuthError(error));
			return;
		}

		const hasSession = isAuthenticatedResult(data) || (await refreshAuthSession());
		if (!hasSession) {
			router.replace("/");
			return;
		}

		router.replace("/basics");
	};

	return (
		<FormScreen
			title={copy.register.title}
			subtitle={copy.register.subtitle}
			hero={<BrandHero tagline={Strings.app.tagline} logoHeight={60} />}
			centered
			footer={
				<>
					<ErrorBanner message={formError} />
					<Button label={copy.register.submit} loading={submitting} onPress={onSubmit} />
					<View style={styles.footerRow}>
						<ThemedText type="caption" style={{ color: theme.muted }}>
							{copy.register.footerPrompt}
						</ThemedText>
						<Link href="/login" replace style={[TextStyles.caption, styles.footerLink, { color: theme.link }]}>
							{copy.register.footerAction}
						</Link>
					</View>
				</>
			}
		>
			<TextField
				label={copy.fields.name}
				placeholder={copy.fields.namePlaceholder}
				value={name}
				onChangeText={setName}
				error={errors.name}
				autoComplete="name"
				textContentType="name"
				returnKeyType="next"
			/>

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
				placeholder={copy.fields.passwordPlaceholder}
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
				label={copy.fields.confirmPassword}
				placeholder={copy.fields.confirmPasswordPlaceholder}
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

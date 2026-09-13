import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { BrandHero } from "@/components/brand-hero";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FormScreen } from "@/components/ui/form-screen";
import { TextField } from "@/components/ui/text-field";
import { Spacing, TextStyles } from "@/constants/app-config";
import { useTheme } from "@/hooks/use-theme";
import { signUp } from "@/lib/auth/client";
import { describeAuthError } from "@/lib/auth/errors";
import { isAuthenticatedResult, refreshAuthSession } from "@/lib/auth/navigation";
import {
	type ValidationError,
	validateConfirmPassword,
	validateEmail,
	validateName,
	validatePassword,
} from "@/lib/utils/validation";

type RegisterErrors = {
	name?: ValidationError;
	email?: ValidationError;
	password?: ValidationError;
	confirmPassword?: ValidationError;
};

export default function RegisterScreen() {
	const { t } = useTranslation();
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
			title={t("auth.register.title")}
			subtitle={t("auth.register.subtitle")}
			hero={<BrandHero tagline={t("app.tagline")} logoHeight={60} />}
			centered
			footer={
				<>
					<ErrorBanner message={formError} />
					<Button label={t("auth.register.submit")} loading={submitting} onPress={onSubmit} />
					<View style={styles.footerRow}>
						<ThemedText type="caption" style={{ color: theme.muted }}>
							{t("auth.register.footerPrompt")}
						</ThemedText>
						<Link href="/login" replace style={[TextStyles.caption, styles.footerLink, { color: theme.link }]}>
							{t("auth.register.footerAction")}
						</Link>
					</View>
				</>
			}
		>
			<TextField
				label={t("auth.fields.name")}
				placeholder={t("auth.fields.namePlaceholder")}
				value={name}
				onChangeText={setName}
				error={errors.name}
				autoComplete="name"
				textContentType="name"
				returnKeyType="next"
			/>

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

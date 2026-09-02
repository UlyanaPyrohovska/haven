import { Strings } from "@/constants/strings";

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validators return an error message, or `undefined` when the value is acceptable. */
export type ValidationError = string | undefined;

export function validateName(value: string): ValidationError {
	return value.trim().length === 0 ? Strings.auth.validation.nameRequired : undefined;
}

export function validateEmail(value: string): ValidationError {
	const trimmed = value.trim();

	if (trimmed.length === 0) {
		return Strings.auth.validation.emailRequired;
	}

	return EMAIL_PATTERN.test(trimmed) ? undefined : Strings.auth.validation.emailInvalid;
}

export function validatePassword(value: string): ValidationError {
	if (value.length === 0) {
		return Strings.auth.validation.passwordRequired;
	}

	return value.length < PASSWORD_MIN_LENGTH ? Strings.auth.validation.passwordTooShort : undefined;
}

export function validateConfirmPassword(password: string, confirmPassword: string): ValidationError {
	return password === confirmPassword ? undefined : Strings.auth.validation.confirmPasswordMismatch;
}

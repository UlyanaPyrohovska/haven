export type EmailContent = { subject: string; html: string; text: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Verification link sent on sign-up and when an unverified user tries to sign in. */
export function verifyEmailTemplate(name: string, url: string): EmailContent {
	const safeName = escapeHtml(name);
	const safeUrl = escapeHtml(url);
	return {
		subject: "Confirm your email for Haven",
		text: `Hi ${name},\n\nConfirm your email to start using Haven (open it on your phone):\n${url}\n\nIf you didn't create a Haven account, ignore this email.`,
		html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1f1f1f">
<h1 style="font-size:20px">Hi ${safeName},</h1>
<p>Tap the button on your phone to confirm your email and open Haven.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1f1f1f;color:#fff;text-decoration:none">Confirm email</a></p>
<p style="font-size:13px;color:#666">If the button doesn't work, open this link: <br>${safeUrl}</p>
<p style="font-size:13px;color:#666">If you didn't create a Haven account, ignore this email.</p>
</div>`,
	};
}

/** Password reset link; the url redirects into the app's reset screen. */
export function resetPasswordTemplate(name: string, url: string): EmailContent {
	const safeName = escapeHtml(name);
	const safeUrl = escapeHtml(url);
	return {
		subject: "Reset your Haven password",
		text: `Hi ${name},\n\nReset your Haven password here (open it on your phone):\n${url}\n\nIf you didn't ask for this, ignore this email. Your password stays the same.`,
		html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#1f1f1f">
<h1 style="font-size:20px">Hi ${safeName},</h1>
<p>Tap the button on your phone to choose a new password.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1f1f1f;color:#fff;text-decoration:none">Reset password</a></p>
<p style="font-size:13px;color:#666">If the button doesn't work, open this link: <br>${safeUrl}</p>
<p style="font-size:13px;color:#666">If you didn't ask for this, ignore this email. Your password stays the same.</p>
</div>`,
	};
}

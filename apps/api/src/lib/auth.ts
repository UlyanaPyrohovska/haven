import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, openAPI } from "better-auth/plugins";
import { getDb } from "@/db";
import { type EmailContent, resetPasswordTemplate, verifyEmailTemplate } from "@/lib/email-templates";
import * as schema from "@/modules/auth/auth-schema";

export const createAuth = (bindings: CloudflareBindings) => {
	const db = getDb(bindings.DATABASE_URL);

	const sendEmail = async (to: string, content: EmailContent) => {
		try {
			await bindings.EMAIL.send({ to, from: { email: bindings.EMAIL_FROM, name: "Haven" }, ...content });
		} catch (error) {
			// Better Auth logs only the stack; surface the binding's E_* code. Never log the content (it holds a token).
			const { code, message } = error as { code?: string; message?: string };
			console.error("auth email failed", { code, message });
			throw error;
		}
	};

	return betterAuth({
		database: drizzleAdapter(db, { provider: "pg", schema }),
		appName: "Haven API",
		basePath: "/auth",
		baseURL: bindings.BETTER_AUTH_URL,
		secret: bindings.BETTER_AUTH_SECRET,
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			revokeSessionsOnPasswordReset: true,
			// url redirects through the browser to haven://reset-password?token=… (redirectTo from the app).
			sendResetPassword: ({ user, url }) => sendEmail(user.email, resetPasswordTemplate(user.name, url)),
		},
		emailVerification: {
			sendOnSignUp: true,
			// Unverified sign-in attempts get a fresh link, so no separate "resend" endpoint is needed.
			sendOnSignIn: true,
			// The app redeems the token itself (GET /auth/verify-email), so the session cookie lands in its storage.
			autoSignInAfterVerification: true,
			sendVerificationEmail: ({ user, token }) => {
				const link = new URL("/links/verify-email", bindings.BETTER_AUTH_URL);
				link.searchParams.set("token", token);
				return sendEmail(user.email, verifyEmailTemplate(user.name, link.toString()));
			},
		},
		trustedOrigins: ["haven://", "http://localhost:5173"],
		plugins: [openAPI(), admin(), expo()],
	});
};

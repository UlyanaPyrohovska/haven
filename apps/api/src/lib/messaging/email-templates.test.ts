import { describe, expect, it } from "vitest";
import { resetPasswordTemplate, verifyEmailTemplate } from "./email-templates";

describe("verifyEmailTemplate", () => {
	it("escapes the user's name in html but keeps it in text", () => {
		const email = verifyEmailTemplate("<script>x</script>", "https://api.test/verify?token=a&b=1");
		expect(email.html).not.toContain("<script>");
		expect(email.html).toContain("token=a&#38;b=1");
		expect(email.text).toContain("<script>x</script>");
		expect(email.text).toContain("https://api.test/verify?token=a&b=1");
	});
});

describe("resetPasswordTemplate", () => {
	it("escapes the name and keeps the raw url in text", () => {
		const email = resetPasswordTemplate("A & B", "https://api.test/reset/t?callbackURL=haven%3A%2F%2Freset-password");
		expect(email.html).toContain("A &#38; B");
		expect(email.text).toContain("https://api.test/reset/t?callbackURL=haven%3A%2F%2Freset-password");
	});
});

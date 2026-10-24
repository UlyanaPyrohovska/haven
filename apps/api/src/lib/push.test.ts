import { describe, expect, it } from "vitest";
import { apnsBody, classifyApnsResponse, classifyFcmResponse, fcmBody, noticeData, pemToDer, signJwt } from "./push";

describe("push payloads", () => {
	it("carries only routing data as strings", () => {
		expect(noticeData({ kind: "message", candidateId: 42 })).toEqual({ type: "message", candidateId: "42" });
		expect(noticeData({ kind: "recommendations" })).toEqual({ type: "recommendations" });
	});

	it("builds an FCM message on the default channel", () => {
		const body = fcmBody("tok", { kind: "match", candidateId: 7 });
		expect(body.message.token).toBe("tok");
		expect(body.message.data).toEqual({ type: "match", candidateId: "7" });
		expect(body.message.android.notification.channel_id).toBe("default");
	});

	it("puts routing data next to aps for APNs", () => {
		const body = apnsBody({ kind: "message", candidateId: 3 });
		expect(body.aps.alert.title).toBeTruthy();
		expect(body).toMatchObject({ type: "message", candidateId: "3" });
	});
});

describe("push response classification", () => {
	it("drops only dead tokens", () => {
		expect(classifyFcmResponse(200, "")).toBe("sent");
		expect(classifyFcmResponse(404, "UNREGISTERED")).toBe("invalid");
		expect(classifyFcmResponse(400, '{"status":"INVALID_ARGUMENT"}')).toBe("invalid");
		expect(classifyFcmResponse(503, "")).toBe("failed");
		expect(classifyApnsResponse(410, '{"reason":"Unregistered"}')).toBe("invalid");
		expect(classifyApnsResponse(400, '{"reason":"BadDeviceToken"}')).toBe("invalid");
		expect(classifyApnsResponse(429, "")).toBe("failed");
	});
});

describe("pemToDer", () => {
	it("decodes a PEM with escaped newlines", () => {
		const pem = "-----BEGIN PRIVATE KEY-----\\nAQID\\n-----END PRIVATE KEY-----\\n";
		expect([...new Uint8Array(pemToDer(pem))]).toEqual([1, 2, 3]);
	});
});

describe("signJwt", () => {
	const toPem = (der: ArrayBuffer) =>
		`-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString("base64")}\n-----END PRIVATE KEY-----`;

	it.each([
		["ES256", { name: "ECDSA", namedCurve: "P-256" }, { name: "ECDSA", hash: "SHA-256" }],
		[
			"RS256",
			{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
			{ name: "RSASSA-PKCS1-v1_5" },
		],
	] as const)("produces a verifiable %s token", async (alg, keyAlg, signAlg) => {
		const pair = (await crypto.subtle.generateKey(keyAlg, true, ["sign", "verify"])) as CryptoKeyPair;
		const pem = toPem((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
		const jwt = await signJwt(alg, pem, { kid: "k" }, { iss: "team" });
		const [header, claims, signature] = jwt.split(".");

		expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg, typ: "JWT", kid: "k" });
		expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({ iss: "team" });
		const valid = await crypto.subtle.verify(
			signAlg,
			pair.publicKey,
			Buffer.from(signature, "base64url"),
			new TextEncoder().encode(`${header}.${claims}`),
		);
		expect(valid).toBe(true);
	});
});

/**
 * Remote push straight to Google FCM (Android) and Apple APNs (iOS), with no relay service in between.
 * Copy is generic on purpose: the payload passes through Google/Apple, so it never carries names or message text.
 */

export type PushPlatform = "ios" | "android";

export type PushNotice =
	| { kind: "message"; candidateId: number }
	| { kind: "match"; candidateId: number }
	| { kind: "recommendations" };

/** Secrets are optional so local dev and unconfigured envs skip push instead of failing. */
export type PushEnv = {
	FCM_PROJECT_ID?: string;
	FCM_CLIENT_EMAIL?: string;
	FCM_PRIVATE_KEY?: string;
	APNS_KEY_ID?: string;
	APNS_TEAM_ID?: string;
	APNS_PRIVATE_KEY?: string;
	APNS_BUNDLE_ID?: string;
};

export type PushResult = "sent" | "invalid" | "failed" | "skipped";

/** Matches the channel the app creates on Android. */
export const ANDROID_CHANNEL_ID = "default";

const COPY: Record<PushNotice["kind"], { title: string; body: string }> = {
	message: { title: "New message", body: "One of your matches wrote to you." },
	match: { title: "It's a match", body: "Someone you liked likes you too." },
	recommendations: { title: "New people to meet", body: "Your new connections are ready." },
};

/** Flat string map: FCM data must be strings, and the app routes taps on it. */
export function noticeData(notice: PushNotice): Record<string, string> {
	return "candidateId" in notice
		? { type: notice.kind, candidateId: String(notice.candidateId) }
		: { type: notice.kind };
}

export function fcmBody(token: string, notice: PushNotice) {
	return {
		message: {
			token,
			notification: COPY[notice.kind],
			data: noticeData(notice),
			android: { priority: "HIGH", notification: { channel_id: ANDROID_CHANNEL_ID } },
		},
	};
}

/** expo-notifications reads a remote iOS notification's data from the `body` key only. */
export function apnsBody(notice: PushNotice) {
	return { aps: { alert: COPY[notice.kind], sound: "default" }, body: noticeData(notice) };
}

/** Only answers that mean "this token is dead" drop the token; anything else is a transient failure. */
export function classifyFcmResponse(status: number, body: string): PushResult {
	if (status === 200) return "sent";
	if (status === 404 || (status === 400 && body.includes("INVALID_ARGUMENT"))) return "invalid";
	return "failed";
}

export function classifyApnsResponse(status: number, body: string): PushResult {
	if (status === 200) return "sent";
	if (status === 410 || (status === 400 && body.includes("BadDeviceToken"))) return "invalid";
	return "failed";
}

function base64url(input: ArrayBuffer | string): string {
	const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Accepts a PEM with real or escaped ("\n") newlines, as pasted into `wrangler secret put`. */
export function pemToDer(pem: string): ArrayBuffer {
	const base64 = pem
		.replace(/\\n/g, "\n")
		.replace(/-----[^-]+-----/g, "")
		.replace(/\s+/g, "");
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer;
}

export async function signJwt(alg: "ES256" | "RS256", pem: string, header: object, claims: object): Promise<string> {
	const algorithm =
		alg === "ES256"
			? { import: { name: "ECDSA", namedCurve: "P-256" }, sign: { name: "ECDSA", hash: "SHA-256" } }
			: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, sign: { name: "RSASSA-PKCS1-v1_5" } };
	const key = await crypto.subtle.importKey("pkcs8", pemToDer(pem), algorithm.import, false, ["sign"]);
	const input = `${base64url(JSON.stringify({ alg, typ: "JWT", ...header }))}.${base64url(JSON.stringify(claims))}`;
	// WebCrypto ECDSA already returns raw r||s, which is the JWS encoding.
	const signature = await crypto.subtle.sign(algorithm.sign, key, new TextEncoder().encode(input));

	return `${input}.${base64url(signature)}`;
}

// Isolate-level caches: Google tokens live 1h, Apple wants a provider token reused for 20–60 min.
let fcmAccess: { token: string; expiresAt: number } | null = null;
let apnsJwt: { token: string; issuedAt: number } | null = null;

async function fcmAccessToken(env: Required<Pick<PushEnv, "FCM_CLIENT_EMAIL" | "FCM_PRIVATE_KEY">>) {
	const now = Math.floor(Date.now() / 1000);

	if (fcmAccess && fcmAccess.expiresAt - 60 > now) {
		return fcmAccess.token;
	}

	const assertion = await signJwt(
		"RS256",
		env.FCM_PRIVATE_KEY,
		{},
		{
			iss: env.FCM_CLIENT_EMAIL,
			scope: "https://www.googleapis.com/auth/firebase.messaging",
			aud: "https://oauth2.googleapis.com/token",
			iat: now,
			exp: now + 3600,
		},
	);
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
	});

	if (!response.ok) {
		throw new Error(`FCM auth failed (${response.status})`);
	}

	const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
	fcmAccess = { token: access_token, expiresAt: now + expires_in };

	return access_token;
}

async function apnsProviderToken(env: Required<Pick<PushEnv, "APNS_KEY_ID" | "APNS_TEAM_ID" | "APNS_PRIVATE_KEY">>) {
	const now = Math.floor(Date.now() / 1000);

	if (apnsJwt && now - apnsJwt.issuedAt < 50 * 60) {
		return apnsJwt.token;
	}

	const token = await signJwt(
		"ES256",
		env.APNS_PRIVATE_KEY,
		{ kid: env.APNS_KEY_ID },
		{ iss: env.APNS_TEAM_ID, iat: now },
	);
	apnsJwt = { token, issuedAt: now };

	return token;
}

async function sendFcm(env: PushEnv, token: string, notice: PushNotice): Promise<PushResult> {
	const { FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY } = env;

	if (!FCM_PROJECT_ID || !FCM_CLIENT_EMAIL || !FCM_PRIVATE_KEY) {
		return "skipped";
	}

	const accessToken = await fcmAccessToken({ FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY });
	const response = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
		method: "POST",
		headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(fcmBody(token, notice)),
	});

	return classifyFcmResponse(response.status, await response.text());
}

const SANDBOX_HOST = "api.sandbox.push.apple.com";
const PRODUCTION_HOST = "api.push.apple.com";

/** APNs needs HTTP/2, which deployed Workers use; local `wrangler dev` may fail here. */
async function sendApns(env: PushEnv, token: string, notice: PushNotice): Promise<PushResult> {
	const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY, APNS_BUNDLE_ID } = env;

	if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY || !APNS_BUNDLE_ID) {
		return "skipped";
	}

	const authorization = `bearer ${await apnsProviderToken({ APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY })}`;
	const post = async (host: string) => {
		const response = await fetch(`https://${host}/3/device/${token}`, {
			method: "POST",
			headers: {
				authorization,
				"apns-topic": APNS_BUNDLE_ID,
				"apns-push-type": "alert",
				"apns-priority": "10",
				"content-type": "application/json",
			},
			body: JSON.stringify(apnsBody(notice)),
		});
		const body = await response.text();

		if (response.status !== 200) {
			// Reason is e.g. {"reason":"BadDeviceToken"}; log the token tail only, never the full token.
			console.error("apns rejected", { host, status: response.status, body, token: token.slice(-6) });
		}

		return { status: response.status, body };
	};

	let result = await post(PRODUCTION_HOST);

	// Ad-hoc/TestFlight builds get production tokens, Xcode debug builds sandbox ones; one Worker serves both.
	if (result.status === 400 && result.body.includes("BadDeviceToken")) {
		result = await post(SANDBOX_HOST);
	}

	return classifyApnsResponse(result.status, result.body);
}

export async function sendPush(
	env: PushEnv,
	device: { token: string; platform: string },
	notice: PushNotice,
): Promise<PushResult> {
	try {
		return device.platform === "ios"
			? await sendApns(env, device.token, notice)
			: await sendFcm(env, device.token, notice);
	} catch (err) {
		console.error("push send failed", err);
		return "failed";
	}
}

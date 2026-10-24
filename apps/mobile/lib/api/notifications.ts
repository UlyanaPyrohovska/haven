import { apiFetch } from "@/lib/api/client";

export type PushPlatform = "ios" | "android";

export async function registerPushToken(token: string, platform: PushPlatform): Promise<void> {
	const response = await apiFetch("/push-token", {
		method: "PUT",
		body: JSON.stringify({ token, platform }),
	});

	if (!response.ok) {
		throw new Error(`Failed to register push token (${response.status})`);
	}
}

export async function unregisterPushToken(token: string): Promise<void> {
	const response = await apiFetch("/push-token", {
		method: "DELETE",
		body: JSON.stringify({ token }),
	});

	if (!response.ok) {
		throw new Error(`Failed to remove push token (${response.status})`);
	}
}

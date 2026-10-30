import type { Db } from "@/db";
import { type PushEnv, type PushNotice, sendPush } from "@/lib/messaging/push";
import type { ViewerContext } from "@/modules/recommendations/service";
import * as repository from "./repository";
import type { PutPushTokenBody } from "./schemas";

export async function registerToken({ db, viewer }: ViewerContext, body: PutPushTokenBody) {
	await repository.upsertToken(db, viewer.id, body.token, body.platform);

	return { ok: true as const };
}

export async function unregisterToken({ db, viewer }: ViewerContext, token: string) {
	await repository.deleteToken(db, viewer.id, token);

	return { ok: true as const };
}

/** Pushes to every device of a profile and prunes dead tokens. Never throws: a push is best effort. */
export async function notify(env: PushEnv, db: Db, profileId: number, notice: PushNotice) {
	try {
		const devices = await repository.listTokens(db, profileId);
		const results = await Promise.all(devices.map((device) => sendPush(env, device, notice)));
		const dead = devices.filter((_, i) => results[i] === "invalid").map((device) => device.token);

		if (dead.length > 0) {
			await repository.deleteTokens(db, dead);
		}
	} catch (err) {
		console.error("notify failed", err);
	}
}

import { DurableObject } from "cloudflare:workers";
import { CHAT_PROFILE_HEADER, type ChatMessagePayload } from "@/lib/messaging/chat";

type Attachment = { profileId: number };

/**
 * One instance per conversation (matched interaction), created in the EU jurisdiction.
 * Holds sockets only: messages are persisted in Neon by the Worker, which then calls `broadcast`.
 */
export class ChatRoom extends DurableObject<CloudflareBindings> {
	async fetch(request: Request): Promise<Response> {
		const profileId = Number(request.headers.get(CHAT_PROFILE_HEADER));

		if (request.headers.get("Upgrade") !== "websocket" || !Number.isInteger(profileId)) {
			return new Response("Expected websocket", { status: 426 });
		}

		const { 0: client, 1: server } = new WebSocketPair();
		this.ctx.acceptWebSocket(server, [String(profileId)]);
		server.serializeAttachment({ profileId } satisfies Attachment);

		return new Response(null, { status: 101, webSocket: client });
	}

	/** Clients only send typing pings; they are relayed to the other participant. */
	async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
		if (typeof raw !== "string") {
			return;
		}

		let frame: unknown;

		try {
			frame = JSON.parse(raw);
		} catch {
			return;
		}

		if ((frame as { type?: unknown })?.type !== "typing") {
			return;
		}

		const { profileId } = ws.deserializeAttachment() as Attachment;

		for (const socket of this.ctx.getWebSockets()) {
			if ((socket.deserializeAttachment() as Attachment).profileId !== profileId) {
				socket.send(JSON.stringify({ type: "typing", senderId: profileId }));
			}
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		ws.close(code, reason);
	}

	broadcast(message: ChatMessagePayload) {
		const frame = JSON.stringify({ type: "message", message });

		for (const socket of this.ctx.getWebSockets()) {
			socket.send(frame);
		}
	}

	/** Called when the match ends (block / report). */
	close() {
		for (const socket of this.ctx.getWebSockets()) {
			socket.close(4003, "Conversation closed");
		}
	}
}

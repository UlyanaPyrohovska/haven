import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { type ChatMessage, type MessagesData, messagesQueryKey, upsertMessage } from "@/lib/api/chat";
import { matchesQueryKey } from "@/lib/api/recommendations";
import { authClient } from "@/lib/auth/client";
import { API_URL } from "@/lib/config/env";

const TYPING_VISIBLE_MS = 3000;
const TYPING_THROTTLE_MS = 2000;
const MAX_BACKOFF_MS = 30_000;
/** Server closes with this code when the match ended (block / report); don't reconnect. */
const CLOSED_BY_SERVER = 4003;

// React Native's WebSocket takes a third `options` arg with headers (no cookie jar); the DOM typing doesn't know it.
const NativeWebSocket = WebSocket as unknown as new (
	url: string,
	protocols?: string | string[],
	options?: { headers: Record<string, string> },
) => WebSocket;

type Frame = { type: "message"; message: ChatMessage } | { type: "typing"; senderId: number };

/**
 * Live updates for one conversation. Messages are sent over REST; the socket only delivers
 * new messages into the react-query cache and relays typing pings.
 */
export function useChatSocket(candidateId: number, onMessage?: (message: ChatMessage) => void) {
	const queryClient = useQueryClient();
	const [peerTyping, setPeerTyping] = useState(false);
	const socketRef = useRef<WebSocket | null>(null);
	const lastTypingSent = useRef(0);
	const onMessageRef = useRef(onMessage);
	onMessageRef.current = onMessage;

	useEffect(() => {
		let disposed = false;
		let backoff = 1000;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let typingTimer: ReturnType<typeof setTimeout> | undefined;

		const connect = () => {
			if (disposed || socketRef.current) {
				return;
			}

			const cookie = authClient.getCookie();
			const socket = new NativeWebSocket(
				`${API_URL.replace(/^http/, "ws")}/matches/${candidateId}/ws`,
				undefined,
				cookie ? { headers: { Cookie: cookie } } : undefined,
			);
			socketRef.current = socket;

			socket.onopen = () => {
				backoff = 1000;
				// Catch up on anything sent while disconnected.
				void queryClient.invalidateQueries({ queryKey: messagesQueryKey(candidateId) });
			};

			socket.onmessage = (event) => {
				let frame: Frame;

				try {
					frame = JSON.parse(String(event.data));
				} catch {
					return;
				}

				if (frame.type === "message") {
					queryClient.setQueryData<MessagesData>(messagesQueryKey(candidateId), (data) =>
						upsertMessage(data, frame.message),
					);
					void queryClient.invalidateQueries({ queryKey: matchesQueryKey });
					setPeerTyping(false);
					onMessageRef.current?.(frame.message);
				} else if (frame.type === "typing" && frame.senderId === candidateId) {
					setPeerTyping(true);
					clearTimeout(typingTimer);
					typingTimer = setTimeout(() => setPeerTyping(false), TYPING_VISIBLE_MS);
				}
			};

			socket.onclose = (event) => {
				socketRef.current = null;

				if (disposed || event.code === CLOSED_BY_SERVER) {
					return;
				}

				retryTimer = setTimeout(connect, backoff);
				backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
			};
		};

		connect();

		const appState = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				clearTimeout(retryTimer);
				connect();
			}
		});

		return () => {
			disposed = true;
			clearTimeout(retryTimer);
			clearTimeout(typingTimer);
			appState.remove();
			socketRef.current?.close();
			socketRef.current = null;
		};
	}, [candidateId, queryClient]);

	const sendTyping = useCallback(() => {
		const now = Date.now();

		if (socketRef.current?.readyState !== WebSocket.OPEN || now - lastTypingSent.current < TYPING_THROTTLE_MS) {
			return;
		}

		lastTypingSent.current = now;
		socketRef.current.send(JSON.stringify({ type: "typing" }));
	}, []);

	return { peerTyping, sendTyping };
}

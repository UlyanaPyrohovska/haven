import type { InfiniteData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export const MESSAGE_MAX_LENGTH = 1000;

export type ChatMessage = {
	/** Negative while an optimistic send is in flight. */
	id: number;
	senderId: number;
	body: string;
	createdAt: string;
};

export type ChatPeer = {
	candidateId: number;
	displayName: string;
	photoUrl: string;
	isSynthetic: boolean;
};

export type MessagesPage = {
	peer: ChatPeer;
	/** Newest first. */
	messages: ChatMessage[];
	hasMore: boolean;
};

export type MessagesData = InfiniteData<MessagesPage, number | undefined>;

export async function fetchMessages(candidateId: number, before?: number): Promise<MessagesPage> {
	const response = await apiFetch(`/matches/${candidateId}/messages${before ? `?before=${before}` : ""}`);

	if (!response.ok) {
		throw new Error(`Failed to load messages (${response.status})`);
	}

	return response.json();
}

export async function sendMessage(candidateId: number, body: string): Promise<{ message: ChatMessage }> {
	const response = await apiFetch(`/matches/${candidateId}/messages`, {
		method: "POST",
		body: JSON.stringify({ body }),
	});

	if (!response.ok) {
		throw new Error(`Failed to send message (${response.status})`);
	}

	return response.json();
}

export async function markMessagesRead(candidateId: number): Promise<void> {
	await apiFetch(`/matches/${candidateId}/read`, { method: "POST" });
}

export const messagesQueryKey = (candidateId: number) => ["messages", candidateId] as const;

/** Inserts or replaces a message at the newest end of the cached thread, ignoring duplicates. */
export function upsertMessage(data: MessagesData | undefined, message: ChatMessage, replaceId?: number) {
	if (!data || data.pages.length === 0) {
		return data;
	}

	const [first, ...rest] = data.pages;
	const withoutReplaced = first.messages.filter((m) => m.id !== replaceId);
	const exists = data.pages.some((page) => page.messages.some((m) => m.id === message.id));
	const messages = exists ? withoutReplaced : [message, ...withoutReplaced];

	return { ...data, pages: [{ ...first, messages }, ...rest] };
}

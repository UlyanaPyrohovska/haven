import type { Db } from "@/db";
import { resolveProfilePhotoUrl } from "@/lib/avatar-url";
import { displayNameForCandidate } from "@/lib/candidate-display";
import {
	CHAT_PROFILE_HEADER,
	type ChatMessagePayload,
	MESSAGE_PAGE_SIZE,
	normalizeMessageBody,
	syntheticOpener,
} from "@/lib/chat";
import { errors } from "@/lib/errors";
import { type ProfileRow, sharedInterestLabels } from "@/lib/profile-view";
import * as recommendationRepository from "@/modules/recommendations/repository";
import type { ViewerContext } from "@/modules/recommendations/service";
import * as repository from "./repository";

type ChatEnv = Pick<CloudflareBindings, "CHAT">;
type Interaction = NonNullable<Awaited<ReturnType<typeof recommendationRepository.findInteractionBetween>>>;

/** Every conversation lives in the EU jurisdiction so chat traffic never leaves it. */
function chatRoom(env: ChatEnv, interactionId: number) {
	const namespace = env.CHAT.jurisdiction("eu");

	return namespace.get(namespace.idFromName(String(interactionId)));
}

export function toMessagePayload(row: repository.MessageRow): ChatMessagePayload {
	return { id: row.id, senderId: row.senderId, body: row.body, createdAt: row.createdAt.toISOString() };
}

async function requireConversation({ db, viewer }: ViewerContext, candidateId: number) {
	const interaction =
		candidateId === viewer.id
			? null
			: await recommendationRepository.findInteractionBetween(db, viewer.id, candidateId);

	if (!interaction?.match) {
		throw errors.not_matched;
	}

	const candidate = await recommendationRepository.findCandidateProfile(db, candidateId);

	if (!candidate) {
		throw errors.not_found;
	}

	return { interaction, candidate: candidate as ProfileRow & { id: number } };
}

/**
 * A synthetic match opens the conversation once, then never replies.
 * shortcut: check-then-insert can double-post under concurrent first opens; add a unique marker if that shows up.
 */
export async function ensureSyntheticOpener(
	db: Db,
	interactionId: number,
	viewer: ProfileRow,
	candidate: ProfileRow & { id: number },
	hasMessages: boolean,
) {
	if (hasMessages || !candidate.isSynthetic) {
		return null;
	}

	return repository.insertMessage(db, {
		interactionId,
		senderId: candidate.id,
		body: syntheticOpener(sharedInterestLabels(candidate, viewer), interactionId),
	});
}

export async function getMessages(ctx: ViewerContext, candidateId: number, beforeId?: number) {
	const { interaction, candidate } = await requireConversation(ctx, candidateId);
	let rows = await repository.listMessages(ctx.db, interaction.id, MESSAGE_PAGE_SIZE + 1, beforeId);

	if (beforeId === undefined && rows.length === 0) {
		const opener = await ensureSyntheticOpener(ctx.db, interaction.id, ctx.viewer, candidate, false);
		rows = opener ? [opener] : [];
	}

	return {
		peer: {
			candidateId,
			displayName: displayNameForCandidate({
				id: candidateId,
				displayName: candidate.displayName as string | null | undefined,
				gender: candidate.gender as number | null | undefined,
				isSynthetic: Boolean(candidate.isSynthetic),
			}),
			photoUrl: resolveProfilePhotoUrl(candidate),
			isSynthetic: Boolean(candidate.isSynthetic),
		},
		// Newest first, for an inverted list.
		messages: rows.slice(0, MESSAGE_PAGE_SIZE).map(toMessagePayload),
		hasMore: rows.length > MESSAGE_PAGE_SIZE,
	};
}

export async function postMessage(ctx: ViewerContext, env: ChatEnv, candidateId: number, rawBody: string) {
	const body = normalizeMessageBody(rawBody);

	if (!body) {
		throw errors.invalid_message;
	}

	const { interaction } = await requireConversation(ctx, candidateId);
	const message = toMessagePayload(
		await repository.insertMessage(ctx.db, { interactionId: interaction.id, senderId: ctx.viewer.id, body }),
	);

	try {
		await chatRoom(env, interaction.id).broadcast(message);
	} catch (err) {
		// The message is saved; clients still get it on their next fetch.
		console.error("chat broadcast failed", err);
	}

	return { message };
}

export async function markRead(ctx: ViewerContext, candidateId: number) {
	const { interaction } = await requireConversation(ctx, candidateId);
	await repository.markRead(ctx.db, interaction.id, ctx.viewer.id);

	return { ok: true as const };
}

/** Forwards a checked websocket upgrade to the conversation's ChatRoom. */
export async function connectSocket(ctx: ViewerContext, env: ChatEnv, candidateId: number, request: Request) {
	if (request.headers.get("Upgrade") !== "websocket") {
		return new Response("Expected websocket", { status: 426 });
	}

	if (!Number.isInteger(candidateId)) {
		throw errors.not_found;
	}

	const { interaction } = await requireConversation(ctx, candidateId);
	const headers = new Headers(request.headers);
	// Set server-side only; overrides anything the client sent.
	headers.set(CHAT_PROFILE_HEADER, String(ctx.viewer.id));

	return chatRoom(env, interaction.id).fetch(new Request(request.url, { headers }));
}

/** Drops live sockets after a block or report ended the match. */
export async function closeConversation(env: ChatEnv, interaction: Interaction | null) {
	if (!interaction) {
		return;
	}

	try {
		await chatRoom(env, interaction.id).close();
	} catch (err) {
		console.error("chat close failed", err);
	}
}

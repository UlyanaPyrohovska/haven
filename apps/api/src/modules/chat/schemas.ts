import { z } from "@hono/zod-openapi";
import { MESSAGE_MAX_LENGTH } from "@/lib/messaging/chat";

export { ErrorSchema } from "@/modules/recommendations/schemas";

export const ChatMessageSchema = z
	.object({
		id: z.number().int(),
		senderId: z.number().int(),
		body: z.string(),
		createdAt: z.string().datetime(),
	})
	.openapi("ChatMessage");

export const MessagesPageSchema = z
	.object({
		peer: z.object({
			candidateId: z.number().int(),
			displayName: z.string(),
			photoUrl: z.string().url(),
			isSynthetic: z.boolean(),
		}),
		messages: z.array(ChatMessageSchema),
		hasMore: z.boolean(),
	})
	.openapi("MessagesPage");

export const SendMessageBodySchema = z
	.object({ body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH) })
	.openapi("SendMessageBody");

export const SendMessageResponseSchema = z.object({ message: ChatMessageSchema }).openapi("SendMessageResponse");

export const MarkReadResponseSchema = z.object({ ok: z.literal(true) }).openapi("MarkReadResponse");

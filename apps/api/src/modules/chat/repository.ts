import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { messages } from "@/db/schema";

export type MessageRow = typeof messages.$inferSelect;

export function listMessages(db: Db, interactionId: number, limit: number, beforeId?: number) {
	return db
		.select()
		.from(messages)
		.where(
			and(eq(messages.interactionId, interactionId), beforeId !== undefined ? lt(messages.id, beforeId) : undefined),
		)
		.orderBy(desc(messages.id))
		.limit(limit);
}

export async function insertMessage(db: Db, values: { interactionId: number; senderId: number; body: string }) {
	const [row] = await db.insert(messages).values(values).returning();

	return row;
}

export async function markRead(db: Db, interactionId: number, readerId: number) {
	await db
		.update(messages)
		.set({ readAt: new Date() })
		.where(and(eq(messages.interactionId, interactionId), ne(messages.senderId, readerId), isNull(messages.readAt)));
}

/** Last message and unread count per conversation, for the inbox. */
export async function listInboxStats(db: Db, interactionIds: number[], viewerId: number) {
	const stats = new Map<number, { lastMessage: MessageRow | null; unreadCount: number }>();

	if (interactionIds.length === 0) {
		return stats;
	}

	const [lastRows, unreadRows] = await Promise.all([
		db
			.selectDistinctOn([messages.interactionId])
			.from(messages)
			.where(inArray(messages.interactionId, interactionIds))
			.orderBy(messages.interactionId, desc(messages.id)),
		db
			.select({ interactionId: messages.interactionId, count: sql<number>`count(*)::int` })
			.from(messages)
			.where(
				and(inArray(messages.interactionId, interactionIds), ne(messages.senderId, viewerId), isNull(messages.readAt)),
			)
			.groupBy(messages.interactionId),
	]);

	for (const id of interactionIds) {
		stats.set(id, { lastMessage: null, unreadCount: 0 });
	}

	for (const row of lastRows) {
		stats.set(row.interactionId, { lastMessage: row, unreadCount: 0 });
	}

	for (const row of unreadRows) {
		const entry = stats.get(row.interactionId);

		if (entry) {
			entry.unreadCount = row.count;
		}
	}

	return stats;
}

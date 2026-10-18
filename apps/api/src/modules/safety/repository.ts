import { and, eq, or } from "drizzle-orm";
import type { Db } from "@/db";
import { interactions, recommendations, reports } from "@/db/schema";
import { findInteractionBetween } from "@/modules/recommendations/repository";

/**
 * A block is stored as the viewer's reject on the pair's interaction, so candidate pools
 * (which skip any pair with an interaction) and matches (match = false) drop it with no extra filter.
 */
export async function blockPair(db: Db, viewerId: number, candidateId: number) {
	const existing = await findInteractionBetween(db, viewerId, candidateId);
	const writeInteraction = existing
		? db
				.update(interactions)
				.set({ ...(existing.userA === viewerId ? { decA: 0 } : { decB: 0 }), match: false })
				.where(eq(interactions.id, existing.id))
		: db.insert(interactions).values({ userA: viewerId, userB: candidateId, decA: 0, match: false });
	const dropRecommendations = db
		.delete(recommendations)
		.where(
			or(
				and(eq(recommendations.userId, viewerId), eq(recommendations.candidateId, candidateId)),
				and(eq(recommendations.userId, candidateId), eq(recommendations.candidateId, viewerId)),
			),
		);

	await db.batch([writeInteraction, dropRecommendations]);
}

export async function insertReport(
	db: Db,
	values: { reporterId: number; reportedId: number; reason: string; details: string | null },
) {
	await db.insert(reports).values(values);
}

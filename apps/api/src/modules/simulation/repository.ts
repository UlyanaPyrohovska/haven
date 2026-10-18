import { and, asc, eq, exists, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@/db";
import { interactions, recommendations, userProfiles } from "@/db/schema";
import { publicProfileColumns, type ViewerProfile } from "@/modules/recommendations/repository";

const target = alias(userProfiles, "target");

/**
 * Likes waiting on a synthetic agent's reply. Only likes that came from a recommendation, so the
 * historical dataset rows (one-sided, never recommended) are left alone.
 */
export function listPendingInboundForSynthetic(db: Db, limit: number) {
	return db
		.select({ likerId: interactions.userA, agentId: interactions.userB })
		.from(interactions)
		.innerJoin(target, eq(target.id, interactions.userB))
		.where(
			and(
				eq(target.isSynthetic, true),
				isNull(interactions.decB),
				eq(interactions.decA, 1),
				exists(
					sql`(
						SELECT 1 FROM ${recommendations}
						WHERE ${recommendations.userId} = ${interactions.userA}
						AND ${recommendations.candidateId} = ${interactions.userB}
						AND ${recommendations.actedOn} = true
					)`,
				),
			),
		)
		.orderBy(asc(interactions.createdAt))
		.limit(limit);
}

export async function sampleSyntheticAgentIds(db: Db, limit: number): Promise<number[]> {
	const rows = await db
		.select({ id: userProfiles.id })
		.from(userProfiles)
		.where(and(eq(userProfiles.isSynthetic, true), eq(userProfiles.discoverable, true)))
		.orderBy(sql`random()`)
		.limit(limit);

	return rows.map((row) => row.id);
}

export async function listRealProfiles(db: Db): Promise<ViewerProfile[]> {
	const rows = await db
		.select(publicProfileColumns)
		.from(userProfiles)
		.where(
			and(eq(userProfiles.isSynthetic, false), eq(userProfiles.discoverable, true), isNotNull(userProfiles.userId)),
		);

	return rows as ViewerProfile[];
}

export function listPendingRecommendationRows(db: Db, viewerId: number) {
	return db
		.select({ id: recommendations.id, candidateId: recommendations.candidateId })
		.from(recommendations)
		.where(and(eq(recommendations.userId, viewerId), eq(recommendations.actedOn, false)))
		.orderBy(asc(recommendations.rank));
}

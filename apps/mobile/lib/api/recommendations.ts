import type { ChatMessage } from "@/lib/api/chat";
import { apiFetch } from "@/lib/api/client";
import type { MoodSlug } from "@/lib/mood";

export type RecommendationSummary = {
	recommendationId: number;
	candidateId: number;
	rank: number;
	score: number;
	displayName: string;
	photoUrl: string;
	ageLabel?: string;
	career: string | null;
	topInterests: string[];
	sharedInterests: string[];
};

export type RecommendationDetail = RecommendationSummary & {
	bio: string | null;
	interests: string[];
	dailyQuestion: string;
	questionAnswer: string | null;
	answerLocked: boolean;
	crossPathsCount: number | null;
	/** City-level area of the last crossing (approximate, never coordinates). */
	crossPathsPlace: string | null;
	crossPathsLastAt: string | null;
	/** City-level area or coarse distance; never coordinates. */
	locationLabel?: string;
	actedOn: boolean;
	mood: MoodSlug | null;
	isSynthetic: boolean;
	/** Present only when both sides accepted. */
	match: MatchDetail | null;
};

export type MatchReason = "sharedInterests" | "theirType" | "yourType" | "nearby" | "crossedPaths" | "compatible";

export type MatchDetail = {
	matchedAt: string;
	/** Reciprocal compatibility in [0, 1]. */
	compatibility: number;
	reasons: MatchReason[];
};

export type MatchSummary = {
	candidateId: number;
	displayName: string;
	photoUrl: string;
	ageLabel?: string;
	topInterests: string[];
	/** City-level area or coarse distance; absent when they don't share location. */
	locationLabel?: string;
	matchedAt: string;
	isSynthetic: boolean;
	lastMessage: ChatMessage | null;
	unreadCount: number;
	lastActivityAt: string;
};

export type RecommendationsListResponse = {
	recommendations: RecommendationSummary[];
	count: number;
	dailyQuestion: string;
	/** True while nothing in the current batch was accepted or declined. */
	canRegenerate: boolean;
	nextRefreshAt?: string;
};

export async function fetchRecommendations(): Promise<RecommendationsListResponse> {
	const response = await apiFetch("/recommendations");

	if (!response.ok) {
		throw new Error(`Failed to load recommendations (${response.status})`);
	}

	return response.json();
}

export async function regenerateRecommendations(): Promise<{ count: number }> {
	const response = await apiFetch("/recommendations/regenerate", { method: "POST" });

	if (!response.ok) {
		throw new Error(`Failed to regenerate recommendations (${response.status})`);
	}

	return response.json();
}

export async function fetchRecommendation(candidateId: number): Promise<RecommendationDetail> {
	const response = await apiFetch(`/recommendations/${candidateId}`);

	if (!response.ok) {
		throw new Error(`Failed to load connection (${response.status})`);
	}

	return response.json();
}

export async function postRecommendationDecision(
	candidateId: number,
	decision: "accept" | "decline",
): Promise<{ matched: boolean; remainingCount: number }> {
	const response = await apiFetch(`/recommendations/${candidateId}/decision`, {
		method: "POST",
		body: JSON.stringify({ decision }),
	});

	if (!response.ok) {
		throw new Error(`Failed to record decision (${response.status})`);
	}

	return response.json();
}

export async function fetchMatches(): Promise<{ matches: MatchSummary[]; count: number }> {
	const response = await apiFetch("/matches");

	if (!response.ok) {
		throw new Error(`Failed to load matches (${response.status})`);
	}

	return response.json();
}

export const recommendationsQueryKey = ["recommendations"] as const;
export const recommendationQueryKey = (candidateId: number) => ["recommendations", candidateId] as const;
export const matchesQueryKey = ["matches"] as const;

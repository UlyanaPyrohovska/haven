// Empty in dev (Vite proxy); set at build time for the deployed site.
const API_URL = import.meta.env.VITE_API_URL ?? "";

type ApiError = { code: string; message: string };

async function parseError(response: Response): Promise<ApiError> {
	try {
		return (await response.json()) as ApiError;
	} catch {
		return { code: "HTTP_ERROR", message: response.statusText || "Request failed" };
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		...init,
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});

	if (!response.ok) {
		const error = await parseError(response);
		throw new Error(error.message || error.code);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export type StaffUserSummary = {
	profileId: number;
	userId: string | null;
	displayName: string | null;
	email: string | null;
	isSynthetic: boolean;
	lookingFor: number;
	createdAt: string;
};

export type StaffUserList = {
	users: StaffUserSummary[];
	total: number;
	limit: number;
	offset: number;
};

export type StaffAuthUser = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	role: string | null;
	banned: boolean | null;
	banReason: string | null;
	createdAt: string;
	updatedAt: string;
};

export type StaffUserDetail = {
	profile: Record<string, unknown>;
	auth: StaffAuthUser | null;
};

export function listUsers(params: { q?: string; limit?: number; offset?: number }) {
	const search = new URLSearchParams();
	if (params.q) {
		search.set("q", params.q);
	}
	if (params.limit !== undefined) {
		search.set("limit", String(params.limit));
	}
	if (params.offset !== undefined) {
		search.set("offset", String(params.offset));
	}

	const query = search.toString();
	return request<StaffUserList>(`/staff/users${query ? `?${query}` : ""}`);
}

export function getUser(profileId: number) {
	return request<StaffUserDetail>(`/staff/users/${profileId}`);
}

export function updateUser(profileId: number, body: Record<string, unknown>) {
	return request<StaffUserDetail>(`/staff/users/${profileId}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}

export function deleteUser(profileId: number) {
	return request<{ deleted: boolean; profileId: number }>(`/staff/users/${profileId}`, {
		method: "DELETE",
	});
}

export type SimulationTickStats = {
	tickId: string;
	inboundAnswered: number;
	agentsActed: number;
	decisions: number;
	accepts: number;
	newMatches: number;
	realBatches: number;
};

export function runSimulationTick(limit?: number) {
	return request<SimulationTickStats>("/staff/simulation/tick", {
		method: "POST",
		body: JSON.stringify(limit ? { limit } : {}),
	});
}

export type GraphEdgeFilter = "match" | "like" | "all";

export type InteractionGraph = {
	nodes: { id: number; name: string; isSynthetic: boolean; lookingFor: number; degree: number }[];
	edges: { source: number; target: number; decA: number | null; decB: number | null; match: boolean }[];
};

export function getInteractionGraph(params: { lookingFor: number; edges: GraphEdgeFilter; since?: string }) {
	const search = new URLSearchParams({ lookingFor: String(params.lookingFor), edges: params.edges });
	if (params.since) search.set("since", params.since);

	return request<InteractionGraph>(`/staff/graph?${search}`);
}

export type DailyCount = { day: string; count: number };

export type StaffStats = {
	days: number;
	profiles: { total: number; synthetic: number; dating: number };
	activity: {
		matches: number;
		messages: number;
		reports: number;
		dailyAnswersToday: number;
		moodCheckinsToday: number;
	};
	signupsByDay: DailyCount[];
	matchesByDay: DailyCount[];
	moods: { mood: string; count: number }[];
};

export function getStats() {
	return request<StaffStats>("/staff/stats");
}

export type StaffRecommendation = {
	candidateId: number;
	name: string;
	isSynthetic: boolean;
	rank: number | null;
	storedScore: number | null;
	shownAt: string;
	actedOn: boolean;
	bio: number | null;
	interest: number;
	geo: number;
	prefUToV: number;
	prefVToU: number;
	pUToV: number;
	qVToU: number;
	reciprocal: number;
	crossings: number;
	score: number;
};

export type StaffRecommendations = {
	weights: { bio: number; interest: number; geo: number; pref: number };
	recommendations: StaffRecommendation[];
};

export function getUserRecommendations(profileId: number) {
	return request<StaffRecommendations>(`/staff/users/${profileId}/recommendations`);
}

export function regenerateUserRecommendations(profileId: number) {
	return request<StaffRecommendations>(`/staff/users/${profileId}/recommendations/regenerate`, { method: "POST" });
}

export type MatchingConfig = {
	batchSize: number;
	cooldownHours: number;
	weights: { bio: number; interest: number; geo: number; pref: number };
	crossPathsLambda: number;
};

export type MatchingConfigResponse = {
	config: MatchingConfig;
	defaults: MatchingConfig;
	updatedAt: string | null;
	updatedBy: string | null;
};

export function getMatchingConfig() {
	return request<MatchingConfigResponse>("/staff/matching-config");
}

export function updateMatchingConfig(config: MatchingConfig) {
	return request<MatchingConfigResponse>("/staff/matching-config", {
		method: "PUT",
		body: JSON.stringify(config),
	});
}

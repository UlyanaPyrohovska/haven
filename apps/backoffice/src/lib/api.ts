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

export type BioEmbeddingBackfill = { embedded: number; removed: number };

/** Re-embeds every bio with Workers AI and drops vectors of cleared bios. */
export function backfillBioEmbeddings() {
	return request<BioEmbeddingBackfill>("/staff/embeddings/backfill", { method: "POST" });
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
	mood: number | null;
	dailyAnswer: number | null;
	pUToV: number;
	qVToU: number;
	reciprocal: number;
	crossings: number;
	score: number;
};

export type ScoreWeights = {
	bio: number;
	interest: number;
	geo: number;
	pref: number;
	mood: number;
	dailyAnswer: number;
};

export type StaffRecommendations = {
	weights: ScoreWeights;
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
	weights: ScoreWeights;
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

export type WalkerCrossing = { count: number; lastCrossedAt: string | null; lastPlace: string | null };

export type Walker = {
	walkerId: number;
	name: string;
	latitude: number | null;
	longitude: number | null;
	locationUpdatedAt: string | null;
	centerLat: number;
	centerLon: number;
	radiusM: number;
	stepM: number;
	active: boolean;
	lastStepAt: string | null;
	createdAt: string;
	createdBy: string | null;
	distanceToTargetM: number | null;
	blockers: string[];
	crossing: WalkerCrossing | null;
};

export type WalkersOverview = {
	rules: { crossingRadiusM: number; windowMinutes: number; cooldownHours: number; stepEveryMinutes: number };
	target: {
		profileId: number;
		name: string;
		isSynthetic: boolean;
		lookingFor: number;
		latitude: number | null;
		longitude: number | null;
		displayLocation: string | null;
		locationUpdatedAt: string | null;
		shareCrossPaths: boolean;
		locationHidden: boolean;
	};
	walkingFor: { targetId: number; name: string } | null;
	walkers: Walker[];
	crossings: (WalkerCrossing & { otherId: number; name: string; isSynthetic: boolean; isWalker: boolean })[];
	lastAction: { assigned?: number; stepped?: number; crossingsRecorded: number } | null;
};

export type AssignWalkersInput = {
	walkerIds?: number[];
	count?: number;
	centerLat?: number;
	centerLon?: number;
	radiusM?: number;
	stepM?: number;
};

export function getWalkers(profileId: number) {
	return request<WalkersOverview>(`/staff/users/${profileId}/walkers`);
}

export function assignWalkers(profileId: number, input: AssignWalkersInput) {
	return request<WalkersOverview>(`/staff/users/${profileId}/walkers`, {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function stepWalkers(profileId: number, markTargetPresent: boolean) {
	return request<WalkersOverview>(`/staff/users/${profileId}/walkers/step`, {
		method: "POST",
		body: JSON.stringify({ markTargetPresent }),
	});
}

export function updateWalker(walkerId: number, updates: { active?: boolean; radiusM?: number; stepM?: number }) {
	return request<WalkersOverview>(`/staff/walkers/${walkerId}`, { method: "PATCH", body: JSON.stringify(updates) });
}

export function removeWalker(walkerId: number) {
	return request<WalkersOverview>(`/staff/walkers/${walkerId}`, { method: "DELETE" });
}

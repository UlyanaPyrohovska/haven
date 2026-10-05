type ApiError = { code: string; message: string };

async function parseError(response: Response): Promise<ApiError> {
	try {
		return (await response.json()) as ApiError;
	} catch {
		return { code: "HTTP_ERROR", message: response.statusText || "Request failed" };
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, {
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

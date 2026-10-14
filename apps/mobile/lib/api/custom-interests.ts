import { apiFetch } from "@/lib/api/client";

/** Mirrors the API limits in `apps/api/src/lib/custom-interests.ts`. */
export const CUSTOM_INTEREST_MAX_LENGTH = 30;
export const MAX_CUSTOM_INTERESTS = 10;

export const customInterestsQueryKey = (query: string) => ["customInterests", query] as const;

/** Interests other users created, most used first. */
export async function searchCustomInterests(query: string): Promise<string[]> {
	const response = await apiFetch(`/interests/custom?q=${encodeURIComponent(query)}`);

	if (!response.ok) {
		throw new Error(`Failed to load interests (${response.status})`);
	}

	const body = (await response.json()) as { interests: string[] };

	return body.interests;
}

/** Adds the label to the shared catalog and resolves to its canonical spelling. Rejections carry the API's reason. */
export async function createCustomInterest(label: string): Promise<string> {
	const response = await apiFetch("/interests/custom", {
		method: "POST",
		body: JSON.stringify({ label }),
	});
	const body = (await response.json().catch(() => null)) as { label?: string; message?: string } | null;

	if (!response.ok || !body?.label) {
		throw new Error(body?.message ?? `Failed to add interest (${response.status})`);
	}

	return body.label;
}
